
import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import "../styles/restaurantStyles.css";

const API = "http://localhost:5299";

export default function RestaurantDashboard() {
    const location = useLocation();
    const navigate = useNavigate();

    const [accessToken, changeAccessToken] = useState(
        location.state?.accessToken ?? ""
    );

    const refreshToken = location.state?.refreshToken;

    const [restaurant, setRestaurant] = useState({
        name: "Restaurant",
        phoneno: "",
        email: "",
        address: ""
    });

    const [availabilitystatus, setAvailabilitystatus] = useState("offline");
    const [statusSaving, setStatusSaving] = useState(false);
    const [menuItems, setMenuItems] = useState([]);
    const [newItem, setNewItem] = useState({
        name: "",
        price: ""
    });

    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    // ---------------- AUTHENTICATED FETCH ----------------

    const apiRequest = useCallback(async (endpoint, options = {}) => {
        const sendRequest = (token) => {
            return fetch(`${API}${endpoint}`, {
                ...options,
                headers: {
                    ...(options.body !== undefined
                        ? { "Content-Type": "application/json" }
                        : {}),
                    ...options.headers,
                    Authorization: `Bearer ${token}`
                }
            });
        };

        let response = await sendRequest(accessToken);

        if (response.status === 401) {
            if (!refreshToken) {
                throw new Error("Session expired. Please log in again.");
            }

            const refreshResponse = await fetch(
                `${API}/api/auth/RefreshToken`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ refreshToken })
                }
            );

            if (!refreshResponse.ok) {
                throw new Error("Session expired. Please log in again.");
            }

            const tokenData = await refreshResponse.json();

            if (!tokenData.accessToken) {
                throw new Error("Could not refresh access token.");
            }

            changeAccessToken(tokenData.accessToken);

            // Retry original request using new access token
            response = await sendRequest(tokenData.accessToken);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);

            throw new Error(
                errorData?.message ||
                `Request failed: ${response.status}`
            );
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    }, [accessToken, refreshToken]);

    // ---------------- FETCH RESTAURANT DETAILS ----------------

    const fetchRestaurant = useCallback(async () => {
        const data = await apiRequest(
            "/api/restaurant/RestaurantDetails"
        );

        setRestaurant({
            name: data.name ?? "",
            phoneno: data.phoneno ?? "",
            email: data.email ?? "",
            address: data.address ?? ""
        });
    }, [apiRequest]);

    // ---------------- FETCH MENU ----------------

    const fetchMenu = useCallback(async () => {
        const data = await apiRequest(
            "/api/restaurant/MenuItems"
        );

        if (!Array.isArray(data)) {
            throw new Error("Invalid menu response from server.");
        }

        setMenuItems(data);
    }, [apiRequest]);

    // ---------------- INITIAL DATA LOADING ----------------

    useEffect(() => {
        let cancelled = false;

        async function loadDashboard() {
            if (!accessToken) {
                setLoading(false);
                return;
            }

            try {
                setErrorMessage("");

                const [details, items, status] = await Promise.all([
                    apiRequest("/api/restaurant/RestaurantDetails"),
                    apiRequest("/api/restaurant/MenuItems"),
                    apiRequest("/api/restaurant/RestaurantStatus")
                ]);

                if (cancelled) return;

                if (!Array.isArray(items)) {
                    throw new Error("Invalid menu response.");
                }

                setRestaurant({
                    name: details.name ?? "",
                    phoneno: details.phoneno ?? "",
                    email: details.email ?? "",
                    address: details.address ?? ""
                });

                setMenuItems(items);
                setAvailabilitystatus(status.availabilitystatus);

            } catch (error) {
                if (!cancelled) {
                    console.error(error);
                    setErrorMessage(error.message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadDashboard();

        return () => {
            cancelled = true;
        };
    }, [accessToken, apiRequest]);

    // ---------------- INPUT HANDLERS ----------------

    const updateRestaurant = (e) => {
        const { name, value } = e.target;

        setRestaurant(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const updateNewItem = (e) => {
        const { name, value } = e.target;

        setNewItem(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // ---------------- UPDATE RESTAURANT ----------------

    const saveRestaurant = async () => {
        try {
            setSaving(true);

            await apiRequest(
                "/api/restaurant/UpdateRestaurantDetails",
                {
                    method: "PUT",
                    body: JSON.stringify({
                        name: restaurant.name,
                        phoneno: restaurant.phoneno,
                        email: restaurant.email,
                        address: restaurant.address
                    })
                }
            );

            await fetchRestaurant();

            alert("Restaurant details updated successfully!");

        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    // ---------------- ADD OR UPDATE MENU ITEM ----------------

    const addOrUpdateItem = async () => {
        const name = newItem.name.trim();
        const price = Number(newItem.price);

        if (
            !name ||
            newItem.price === "" ||
            !Number.isFinite(price) ||
            price <= 0
        ) {
            alert("Enter a valid item name and price.");
            return;
        }

        try {
            setSaving(true);

            if (editingId !== null) {
                // Update existing item
                await apiRequest(
                    "/api/restaurant/EditMenuItem",
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            itemid: editingId,
                            newname: name,
                            newprice: price
                        })
                    }
                );
            } else {
                // Add new item
                await apiRequest(
                    "/api/restaurant/AddMenuItem",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            itemname: name,
                            itemprice: price
                        })
                    }
                );
            }

            // Reload menu from MySQL
            await fetchMenu();

            setEditingId(null);
            setNewItem({
                name: "",
                price: ""
            });

            alert("Menu item saved successfully!");

        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    // ---------------- SELECT ITEM FOR EDITING ----------------

    const editItem = (item) => {
        setNewItem({
            name: item.name,
            price: String(item.price)
        });

        setEditingId(item.id);
    };

    // ---------------- DELETE MENU ITEM ----------------

    const deleteItem = async (id) => {
        if (!window.confirm("Delete this menu item?")) {
            return;
        }

        try {
            setSaving(true);

            await apiRequest(
                "/api/restaurant/DeleteMenuItem",
                {
                    method: "DELETE",
                    body: JSON.stringify({
                        itemid: id
                    })
                }
            );

            await fetchMenu();

            if (editingId === id) {
                setEditingId(null);
                setNewItem({
                    name: "",
                    price: ""
                });
            }

            alert("Menu item deleted successfully!");

        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    // ---------------- RESTAURANT AVAILABILITY ----------------

    const toggleAvailability = async () => {
        const next=availabilitystatus==="available"?"offline":"available";
        try{
            setStatusSaving(true);
            await apiRequest("/api/restaurant/UpdateRestaurantStatus",{method:"PUT",body:JSON.stringify({restaurantstatus:next})});
            const data=await apiRequest("/api/restaurant/RestaurantStatus");
            setAvailabilitystatus(data.availabilitystatus);
        }
        catch(error){
            console.error(error);
            alert(error.message);
        }
        finally{setStatusSaving(false);}
    };

    // ---------------- LOGOUT ----------------

    const logout = async () => {
        try {
            setSaving(true);

            await apiRequest("/api/auth/Logout", {
                method: "POST",
                body: JSON.stringify({ refreshToken })
            });

            changeAccessToken("");
            navigate("/", { replace: true, state: null });

        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    // ---------------- DEACTIVATE ACCOUNT ----------------

    const deactivateAccount = async () => {
        if (!window.confirm("Deactivate your restaurant account?")) {
            return;
        }

        try {
            setSaving(true);

            await apiRequest("/api/auth/DeleteAccount", {
                method: "DELETE"
            });

            // Revoke refresh token after deactivation
            try {
                await apiRequest("/api/auth/Logout", {
                    method: "POST",
                    body: JSON.stringify({ refreshToken })
                });
            } catch (error) {
                console.error("Token revocation failed:", error);
            }

            changeAccessToken("");
            navigate("/", { replace: true, state: null });

        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    // ---------------- RENDER ----------------

    if (!accessToken) {
        return <p>Please log in to access the restaurant dashboard.</p>;
    }

    if (loading) {
        return <p>Loading restaurant dashboard...</p>;
    }

    return (
        <div id="restaurantDashboard">
            <h1>Restaurant Dashboard</h1>

            {errorMessage && (
                <p role="alert">{errorMessage}</p>
            )}

            <section className="restaurantSection">
                <h2>Restaurant Availability</h2>
                <p><strong>Current Status: </strong>{availabilitystatus==="available"?"ONLINE":"OFFLINE"}</p>
                <button className="restaurantButton" onClick={toggleAvailability} disabled={statusSaving || saving}>
                    {statusSaving?"UPDATING...":availabilitystatus==="available"?"GO OFFLINE":"GO ONLINE"}
                </button>
            </section>

            <section className="restaurantSection">
                <h2>Restaurant Details</h2>

                <div className="restaurantField">
                    <label htmlFor="restaurantName">
                        Restaurant Name:
                    </label>
                    <input
                        id="restaurantName"
                        name="name"
                        value={restaurant.name}
                        onChange={updateRestaurant}
                    />
                </div>

                <div className="restaurantField">
                    <label htmlFor="restaurantPhone">
                        Phone Number:
                    </label>
                    <input
                        id="restaurantPhone"
                        name="phoneno"
                        type="tel"
                        value={restaurant.phoneno}
                        onChange={updateRestaurant}
                    />
                </div>

                <div className="restaurantField">
                    <label htmlFor="restaurantEmail">
                        Email:
                    </label>
                    <input
                        id="restaurantEmail"
                        name="email"
                        type="email"
                        value={restaurant.email}
                        onChange={updateRestaurant}
                    />
                </div>

                <div className="restaurantField">
                    <label htmlFor="restaurantAddress">
                        Address:
                    </label>
                    <textarea
                        id="restaurantAddress"
                        name="address"
                        value={restaurant.address}
                        onChange={updateRestaurant}
                    />
                </div>

                <button
                    className="restaurantButton"
                    onClick={saveRestaurant}
                    disabled={saving}
                >
                    UPDATE DETAILS
                </button>
            </section>

            <section className="restaurantSection">
                <h2>Menu Management</h2>

                <div className="restaurantField">
                    <label htmlFor="itemName">
                        Item Name:
                    </label>
                    <input
                        id="itemName"
                        name="name"
                        value={newItem.name}
                        onChange={updateNewItem}
                    />
                </div>

                <div className="restaurantField">
                    <label htmlFor="itemPrice">
                        Price (₹):
                    </label>
                    <input
                        id="itemPrice"
                        name="price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={newItem.price}
                        onChange={updateNewItem}
                    />
                </div>

                <button
                    className="restaurantButton"
                    onClick={addOrUpdateItem}
                    disabled={saving}
                >
                    {editingId !== null
                        ? "UPDATE ITEM"
                        : "ADD ITEM"}
                </button>

                {editingId !== null && (
                    <button
                        className="restaurantButton"
                        disabled={saving}
                        onClick={() => {
                            setEditingId(null);
                            setNewItem({
                                name: "",
                                price: ""
                            });
                        }}
                    >
                        CANCEL
                    </button>
                )}

                <h2>Current Menu</h2>

                <table className="menuTable">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Price</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {menuItems.map(item => (
                            <tr key={item.id}>
                                <td>{item.name}</td>
                                <td>
                                    ₹{Number(item.price).toFixed(2)}
                                </td>
                                <td>
                                    <button
                                        className="tableButton"
                                        disabled={saving}
                                        onClick={() => editItem(item)}
                                    >
                                        EDIT
                                    </button>

                                    <button
                                        className="tableButton"
                                        disabled={saving}
                                        onClick={() => deleteItem(item.id)}
                                    >
                                        DELETE
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {menuItems.length === 0 && (
                    <p>No menu items added yet.</p>
                )}
            </section>

            <button
                id="Logout"
                onClick={logout}
                disabled={saving}
            >
                Logout
            </button>

            <button
                id="DeactivateAccount"
                onClick={deactivateAccount}
                disabled={saving}
            >
                Deactivate Account
            </button>
        </div>
    );
}