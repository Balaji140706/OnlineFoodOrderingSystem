import { useRef } from "react";
import { useNavigate } from "react-router";
import "../styles/loginStyles.css";
import userPic from "../public/User_pic.jpg";

export default function Login() {
    const usernameRef = useRef();
    const passwordRef = useRef();
    const roleRef = useRef();
    const navigate=useNavigate();
    const createAccountClick = async () => {
        try {
            const response = await fetch(
                "http://localhost:5299/api/auth/CreateAccount",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username: usernameRef.current.value,
                        password: passwordRef.current.value,
                        role: roleRef.current.value
                    })
                }
            );

            const data = await response.json();
            console.log("Server role:", data.role);
            console.log("Selected role:", roleRef.current.value);
            if (response.ok) {
                alert("Account created successfully!");
                console.log(data);
            } else {
                alert(data.message || "Account creation failed!");
            }

        } catch (error) {
            console.error("Error:", error);
            alert("Unable to connect to server!");
        }
    };
    const loginClick = async () => {
        if (!roleRef.current.value) {
            alert("Please select a role!");
            return;
        }
        try {
            const response = await fetch(
                "http://localhost:5299/api/auth/Login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username: usernameRef.current.value,
                        password: passwordRef.current.value,
                        role: roleRef.current.value
                    })
                }
            );

            const data = await response.json();

            if (response.ok) {
                alert("Logged in successfully!");

                const tokens = {
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken
                };
                if (data.role === "admin") {
                    navigate("/Admin", { state: tokens });
                }
                else if (data.role === "customer") {
                    navigate("/Customer", { state: tokens });
                }
                else if (data.role === "restaurant") {
                    navigate("/Restaurant", { state: tokens });
                }
                else if (data.role === "delivery") {
                    navigate("/Delivery", { state: tokens });
                }
                else {
                    alert("Invalid role returned by server!");
                }
            }
            else {
                alert(data.message || "Log in failed!");
            }
        }
        catch (error) {
            console.error("Error:", error);
            alert("Unable to connect to server!");
        }
    };
    return (
        <div id="Login_div">
            <img
                src={userPic}
                style={{
                    width: 350,
                    height: 200,
                    objectFit: "cover",
                    objectPosition: "center"
                }}
            />

            <h1 id="heading">User Login</h1>

            <div id="username_combo">
                <label htmlFor="username" id="Login_label_username">
                    Username:
                </label>
                <input id="username" ref={usernameRef} />
            </div>

            <div id="password_combo">
                <label htmlFor="password" id="Login_label_password">
                    Password:
                </label>
                <input
                    id="password"
                    type="password"
                    ref={passwordRef}
                />
            </div>
            <div id="role_combo">
                <label htmlFor="role" style={{fontSize:"large"}}>Role: </label>
                <select 
                    id="role" 
                    ref={roleRef}
                    defaultValue=""
                >
                    <option value="" disabled>--Select an option--</option>
                    <option value="customer">customer</option>
                    <option value="restaurant">restaurant</option>
                    <option value="delivery">delivery</option>
                    <option value="admin">admin</option>
                </select>
            </div>
            <button
                id="createAccount"
                onClick={createAccountClick}
            >
                CREATE ACCOUNT
            </button>

            <button id="login" onClick={loginClick}>LOGIN</button>
        </div>
    );
}