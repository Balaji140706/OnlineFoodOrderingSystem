import {useEffect,useRef,useState} from "react";
import {useLocation,useNavigate} from "react-router";
import "../styles/customerStyles.css";

const API="http://localhost:5299/api";

export default function Customer(){
    const navigate=useNavigate(),location=useLocation();
    const tokenRef=useRef(location.state?.accessToken||""),refreshRef=useRef(location.state?.refreshToken||"");
    const refreshPromiseRef=useRef(null);
    const [customer,setCustomer]=useState({name:"",email:"",phoneno:"",address:""});
    const [customerDraft,setCustomerDraft]=useState({name:"",email:"",phoneno:"",address:""});
    const [editingCustomer,setEditingCustomer]=useState(false);
    const [previousOrders,setPreviousOrders]=useState([]),[restaurants,setRestaurants]=useState([]);
    const [search,setSearch]=useState(""),[selectedRestaurant,setSelectedRestaurant]=useState(null),[menu,setMenu]=useState([]);
    const [cart,setCart]=useState([]),[paymentMethod,setPaymentMethod]=useState("COD");
    const [selectedOrder,setSelectedOrder]=useState(null),[orderItems,setOrderItems]=useState([]),[reviews,setReviews]=useState(null);
    const [restaurantRating,setRestaurantRating]=useState(5),[deliveryRating,setDeliveryRating]=useState(5);
    const [restaurantReview,setRestaurantReview]=useState(""),[deliveryReview,setDeliveryReview]=useState("");
    const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");

    const apiRequest=async(path,method="GET",body,canRetry=true)=>{
        const options={method,headers:{Authorization:`Bearer ${tokenRef.current}`}};
        if(body!==undefined){options.headers["Content-Type"]="application/json";options.body=JSON.stringify(body);}
        const response=await fetch(`${API}/customer/${path}`,options);
        if(response.status===401 && canRetry && refreshRef.current){
            if(!refreshPromiseRef.current){
                refreshPromiseRef.current=(async()=>{
                    const result=await fetch(`${API}/auth/RefreshToken`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:refreshRef.current})});
                    if(!result.ok) throw new Error("Session expired. Please log in again.");
                    const data=await result.json();tokenRef.current=data.accessToken;
                    if(data.refreshToken) refreshRef.current=data.refreshToken;
                })().finally(()=>{refreshPromiseRef.current=null;});
            }
            await refreshPromiseRef.current;
            return apiRequest(path,method,body,false);
        }
        if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||`Request failed (${response.status})`);}
        return response.status===204?null:response.json();
    };

    const loadOrders=async()=>{
        const orders=await apiRequest("PreviousOrders");
        setPreviousOrders(orders);
        setSelectedOrder(prev=>prev?(orders.find(order=>order.orderid===prev.orderid)||null):null);
    };
    const loadRestaurants=async(query="")=>setRestaurants(await apiRequest("QueryRestaurants","POST",{queryString:query}));
    useEffect(()=>{
        if(!tokenRef.current){navigate("/Login",{replace:true});return;}
        let active=true;
        (async()=>{
            try{
                const [details,orders,list]=await Promise.all([apiRequest("CustomerDetails"),apiRequest("PreviousOrders"),apiRequest("QueryRestaurants","POST",{queryString:""})]);
                if(active){setCustomer(details);setCustomerDraft(details);setPreviousOrders(orders);setRestaurants(list);}
            }catch(err){if(active)setError(err.message);}
            finally{if(active)setLoading(false);}
        })();
        return ()=>{active=false;};
    },[]);

    useEffect(()=>{
        if(loading)return;
        const timer=setTimeout(()=>loadRestaurants(search).catch(err=>setError(err.message)),300);
        return ()=>clearTimeout(timer);
    },[search,loading]);

    useEffect(()=>{
        if(loading || !tokenRef.current)return;
        let active=true;
        let fetching=false;
        const refresh=async()=>{
            if(fetching || !active || document.hidden)return;
            fetching=true;
            try{
                const orders=await apiRequest("PreviousOrders");
                if(active){
                    setPreviousOrders(orders);
                    setSelectedOrder(prev=>prev?(orders.find(order=>order.orderid===prev.orderid)||null):null);
                }
            }catch(err){console.error("Automatic order refresh failed:",err);}
            finally{fetching=false;}
        };
        const timer=setInterval(refresh,5000);
        return ()=>{active=false;clearInterval(timer);};
    },[loading]);

    const statusLabel=status=>({pending:"Pending Delivery",fulfilled:"Delivered",cancelled:"Cancelled"}[status]||status);

    const saveCustomer=async()=>{
        if(Object.values(customerDraft).some(value=>!String(value).trim())) return setError("Fill all customer details.");
        setBusy(true);setError("");
        try{await apiRequest("UpdateCustomerDetails","PUT",customerDraft);setCustomer({...customerDraft});setEditingCustomer(false);}
        catch(err){setError(err.message);}finally{setBusy(false);}
    };
    const selectRestaurant=async(restaurant)=>{
        if(cart.length && selectedRestaurant?.id!==restaurant.id && !window.confirm("Changing restaurants will clear your cart. Continue?"))return;
        setBusy(true);setError("");
        try{const items=await apiRequest("RestaurantMenu","POST",{restaurantid:restaurant.id});
            if(selectedRestaurant?.id!==restaurant.id)setCart([]);
            setSelectedRestaurant(restaurant);setMenu(items);
        }catch(err){setError(err.message);}finally{setBusy(false);}
    };
    const addToCart=item=>setCart(prev=>{
        const found=prev.find(entry=>entry.id===item.id);
        return found?prev.map(entry=>entry.id===item.id?{...entry,quantity:entry.quantity+1}:entry):[...prev,{...item,quantity:1}];
    });
    const changeQuantity=(itemid,change)=>setCart(prev=>prev.map(item=>item.id===itemid?{...item,quantity:item.quantity+change}:item).filter(item=>item.quantity>0));
    const totalPrice=cart.reduce((sum,item)=>sum+Number(item.price)*item.quantity,0);
    const placeOrder=async()=>{
        if(!selectedRestaurant || !cart.length)return setError("Select a restaurant and add items first.");
        setBusy(true);setError("");
        try{
            const result=await apiRequest("PlaceOrder","POST",{restaurantid:selectedRestaurant.id,paymentmethod:paymentMethod,items:cart.map(item=>({menuitemid:item.id,quantity:item.quantity}))});
            setCart([]);await loadOrders();alert(`Order #${result.orderid} placed successfully!`);
        }catch(err){setError(err.message);}finally{setBusy(false);}
    };
    const cancelOrder=async(orderid)=>{
        if(!window.confirm(`Cancel order #${orderid}?`))return;
        setBusy(true);setError("");
        try{await apiRequest("CancelOrder","PUT",{orderid});await loadOrders();if(selectedOrder?.orderid===orderid)setSelectedOrder(null);}
        catch(err){setError(err.message);}finally{setBusy(false);}
    };
    const viewOrder=async(order)=>{
        setBusy(true);setError("");setSelectedOrder(null);
        try{
            const [items,reviewData]=await Promise.all([apiRequest("CustomerOrderItems","POST",{orderid:order.orderid}),apiRequest("GetOrderReviews","POST",{orderid:order.orderid})]);
            setOrderItems(items);setReviews(reviewData);setSelectedOrder(order);setRestaurantRating(5);setDeliveryRating(5);setRestaurantReview("");setDeliveryReview("");
        }catch(err){setError(err.message);}finally{setBusy(false);}
    };
    const submitReview=async(type)=>{
        if(!selectedOrder)return;
        setBusy(true);setError("");
        try{
            const isRestaurant=type==="restaurant";
            await apiRequest(isRestaurant?"SubmitRestaurantReview":"SubmitDeliveryReview","POST",{orderid:selectedOrder.orderid,rating:isRestaurant?restaurantRating:deliveryRating,review:isRestaurant?restaurantReview:deliveryReview});
            const updated=await apiRequest("GetOrderReviews","POST",{orderid:selectedOrder.orderid});setReviews(updated);
        }catch(err){setError(err.message);}finally{setBusy(false);}
    };
    const logout=async()=>{
        try{if(refreshRef.current)await fetch(`${API}/auth/Logout`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:refreshRef.current})});}catch(err){console.error(err);}
        tokenRef.current="";refreshRef.current="";navigate("/",{replace:true,state:null});
    };

    if(loading)return <div id="Customer_div"><h2>Loading customer details...</h2>{error && <p role="alert">{error}</p>}</div>;
    return <div id="Customer_div">
        <h1 id="Customer_heading">Customer Page</h1>
        {error && <p role="alert" style={{color:"crimson"}}>{error}</p>}
        <div className="Customer_actions"><button className="Customer_button" onClick={()=>loadOrders().catch(err=>setError(err.message))}>REFRESH ORDERS</button><button className="Customer_button" onClick={logout}>LOGOUT</button></div>

        <section className="Customer_section">
            <h2>Customer Details</h2>
            {[{key:"name",label:"Name"},{key:"email",label:"Email"},{key:"phoneno",label:"Phone Number"},{key:"address",label:"Address"}].map(field=><div className="Customer_field" key={field.key}>
                <label htmlFor={`customer-${field.key}`}>{field.label}:</label>
                {field.key==="address"?<textarea id={`customer-${field.key}`} value={customerDraft[field.key]||""} disabled={!editingCustomer} onChange={e=>setCustomerDraft(prev=>({...prev,[field.key]:e.target.value}))}/>:<input id={`customer-${field.key}`} type={field.key==="email"?"email":"text"} value={customerDraft[field.key]||""} disabled={!editingCustomer} onChange={e=>setCustomerDraft(prev=>({...prev,[field.key]:e.target.value}))}/>}
            </div>)}
            {editingCustomer?<div className="Customer_actions"><button className="Customer_button" disabled={busy} onClick={saveCustomer}>SAVE DETAILS</button><button className="Customer_button" onClick={()=>{setCustomerDraft({...customer});setEditingCustomer(false);}}>CANCEL</button></div>:<button className="Customer_button" onClick={()=>setEditingCustomer(true)}>UPDATE DETAILS</button>}
        </section>

        <section className="Customer_section">
            <h2>Previous Orders</h2>
            {!previousOrders.length?<p>No previous orders.</p>:<div className="Customer_tableWrapper"><table className="Customer_table"><thead><tr><th>Order ID</th><th>Restaurant</th><th>Date</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                {previousOrders.map(order=><tr key={order.orderid}><td>{order.orderid}</td><td>{order.restaurant}</td><td>{order.timestamp?new Date(order.timestamp).toLocaleString():"-"}</td><td>₹{Number(order.total).toFixed(2)}</td><td>{statusLabel(order.status)}</td><td><button className="Customer_smallButton" disabled={busy} onClick={()=>viewOrder(order)}>DETAILS / REVIEW</button> {order.status==="pending" && <button className="Customer_smallButton" disabled={busy} onClick={()=>cancelOrder(order.orderid)}>CANCEL ORDER</button>}</td></tr>)}
            </tbody></table></div>}
        </section>

        {selectedOrder && <section className="Customer_section">
            <h2>Order #{selectedOrder.orderid} Details</h2>
            <p>Restaurant: {selectedOrder.restaurant} | Status: {statusLabel(selectedOrder.status)}</p>
            <p>Order Date: {selectedOrder.timestamp?new Date(selectedOrder.timestamp).toLocaleString():"-"} | Total: ₹{Number(selectedOrder.total).toFixed(2)}</p>
            <h3>Assigned Delivery Partner</h3>
            {selectedOrder.deliveryname?<div>
                <p>Name: {selectedOrder.deliveryname}</p>
                <p>Phone: {selectedOrder.deliveryphone||"Not available"}</p>
                <p>Zone: {selectedOrder.deliveryzone||"Not available"}</p>
                <p>Rating: {selectedOrder.deliveryrating??"Not rated"} / 5</p>
            </div>:<p>No delivery partner assigned yet.</p>}
            <div className="Customer_tableWrapper"><table className="Customer_table"><thead><tr><th>Item</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead><tbody>
                {orderItems.map((item,index)=><tr key={index}><td>{item.name}</td><td>{item.quantity}</td><td>₹{Number(item.unitprice).toFixed(2)}</td><td>₹{(Number(item.unitprice)*item.quantity).toFixed(2)}</td></tr>)}
            </tbody></table></div>
            {selectedOrder.status==="fulfilled" && <>
                <h3>Restaurant Review</h3>
                {reviews?.restaurantrating!=null?<p>Rated {reviews.restaurantrating}/5 — {reviews.restaurantreview||"No comment"}</p>:<div className="Customer_actions"><select className="Customer_input" value={restaurantRating} onChange={e=>setRestaurantRating(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select><input className="Customer_input" placeholder="Restaurant review" value={restaurantReview} onChange={e=>setRestaurantReview(e.target.value)}/><button className="Customer_button" disabled={busy} onClick={()=>submitReview("restaurant")}>SUBMIT RESTAURANT REVIEW</button></div>}
                <h3>Delivery Partner Review</h3>
                {reviews?.deliveryrating!=null?<p>Rated {reviews.deliveryrating}/5 — {reviews.deliveryreview||"No comment"}</p>:<div className="Customer_actions"><select className="Customer_input" value={deliveryRating} onChange={e=>setDeliveryRating(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select><input className="Customer_input" placeholder="Delivery review" value={deliveryReview} onChange={e=>setDeliveryReview(e.target.value)}/><button className="Customer_button" disabled={busy} onClick={()=>submitReview("delivery")}>SUBMIT DELIVERY REVIEW</button></div>}
            </>}
            <button className="Customer_button" onClick={()=>setSelectedOrder(null)}>CLOSE DETAILS</button>
        </section>}

        <section className="Customer_section"><h2>Place an Order</h2><label htmlFor="restaurantSearch">Search Restaurants:</label>
            <input id="restaurantSearch" className="Customer_input" type="search" placeholder="Enter restaurant name" value={search} onChange={e=>setSearch(e.target.value)}/>
            <div className="Customer_restaurantList">{restaurants.map(restaurant=><div className="Customer_restaurant" key={restaurant.id}><div><h3>{restaurant.name}</h3><p>Rating: {restaurant.rating??"Not rated"} / 5</p></div><button className="Customer_button" disabled={busy} onClick={()=>selectRestaurant(restaurant)}>VIEW MENU</button></div>)}{!restaurants.length && <p>No restaurants found.</p>}</div>
        </section>

        {selectedRestaurant && <section className="Customer_section"><h2>{selectedRestaurant.name} - Menu</h2><div className="Customer_menuList">{menu.map(item=><div className="Customer_menuItem" key={item.id}><div><h3>{item.name}</h3><p>₹{Number(item.price).toFixed(2)}</p></div><button className="Customer_button" onClick={()=>addToCart(item)}>ADD +</button></div>)}{!menu.length && <p>No menu items available.</p>}</div></section>}

        <section className="Customer_section"><h2>Your Cart</h2>
            {!cart.length?<p>Your cart is empty.</p>:<div className="Customer_tableWrapper"><table className="Customer_table"><thead><tr><th>Item</th><th>Price</th><th>Quantity</th><th>Subtotal</th><th>Remove</th></tr></thead><tbody>
                {cart.map(item=><tr key={item.id}><td>{item.name}</td><td>₹{Number(item.price).toFixed(2)}</td><td><div className="Customer_quantity"><button onClick={()=>changeQuantity(item.id,-1)}>-</button><span>{item.quantity}</span><button onClick={()=>changeQuantity(item.id,1)}>+</button></div></td><td>₹{(Number(item.price)*item.quantity).toFixed(2)}</td><td><button className="Customer_smallButton" onClick={()=>setCart(prev=>prev.filter(entry=>entry.id!==item.id))}>REMOVE</button></td></tr>)}
            </tbody></table></div>}
            <h2 className="Customer_total">Total: ₹{totalPrice.toFixed(2)}</h2>
            <div className="Customer_payment"><label htmlFor="paymentMethod">Payment Method:</label><select id="paymentMethod" className="Customer_input" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="COD">Cash on Delivery</option><option value="UPI">UPI</option><option value="CARD">Credit / Debit Card</option></select></div>
            <button id="Customer_placeOrder" onClick={placeOrder} disabled={busy || !cart.length}>PLACE ORDER</button>
        </section>
    </div>;
}
