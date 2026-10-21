import {useRef,useState,useCallback} from "react";
import {useLocation,useNavigate} from "react-router";
import "../styles/adminStyles.css";

const API="http://localhost:5299";

export default function Admin(){
    const location=useLocation();
    const navigate=useNavigate();

    const accessTokenRef=useRef(location.state?.accessToken??"");
    const refreshToken=location.state?.refreshToken;
    const refreshPromiseRef=useRef(null);
    const promptRef=useRef(null);

    const [Response,setResponse]=useState("");
    const [loading,setLoading]=useState(false);
    const [error,setError]=useState("");

    const apiRequest=useCallback(async(endpoint,options={})=>{
        const send=(token)=>fetch(API+endpoint,{
            ...options,
            headers:{
                ...(options.body!==undefined?{"Content-Type":"application/json"}:{}),
                ...options.headers,
                Authorization:`Bearer ${token}`
            }
        });

        let response=await send(accessTokenRef.current);

        if(response.status===401){
            if(!refreshToken) throw new Error("Session expired! Please log in again.");

            if(!refreshPromiseRef.current){
                refreshPromiseRef.current=(async()=>{
                    const res=await fetch(API+"/api/auth/RefreshToken",{
                        method:"POST",
                        headers:{"Content-Type":"application/json"},
                        body:JSON.stringify({refreshToken})
                    });

                    if(!res.ok) throw new Error("Session expired! Please log in again.");

                    const data=await res.json();
                    if(!data.accessToken) throw new Error("Could not refresh access token!");

                    accessTokenRef.current=data.accessToken;
                    return data.accessToken;
                })().finally(()=>{refreshPromiseRef.current=null;});
            }

            const token=await refreshPromiseRef.current;
            response=await send(token);
        }

        if(!response.ok){
            const data=await response.json().catch(()=>null);
            throw new Error(data?.message||`Request failed: ${response.status}`);
        }

        if(response.status===204) return null;
        return response.json();
    },[refreshToken]);

    const getResponse=async()=>{
        const prompt=promptRef.current?.value.trim();

        if(!prompt){
            alert("Please enter a prompt!");
            return;
        }

        try{
            setLoading(true);
            setError("");
            setResponse("");

            const data=await apiRequest("/api/admin/PromptToSQL",{
                method:"POST",
                body:JSON.stringify({prompt})
            });

            const query=data.response;
            if(typeof query!=="string" || !query.trim()) throw new Error("AI did not generate a valid SQL query!");

            const data1=await apiRequest("/api/admin/RunQuery",{
                method:"POST",
                body:JSON.stringify({query})
            });

            const data2=await apiRequest("/api/admin/SQLToText",{
                method:"POST",
                body:JSON.stringify({
                    prompt,
                    sqlquery:query,
                    queryoutput:JSON.stringify(data1)
                })
            });

            setResponse(data2.response);
        }
        catch(err){
            console.error(err);
            setError(err.message);
        }
        finally{
            setLoading(false);
        }
    };

    const downloadResponse=()=>{
        if(!Response){
            alert("No response available to download!");
            return;
        }

        const blob=new Blob([Response],{type:"text/plain;charset=utf-8"});
        const url=URL.createObjectURL(blob);
        const link=document.createElement("a");

        link.href=url;
        link.download="adminResponse.txt";
        link.click();

        URL.revokeObjectURL(url);
    };

    const logout=async()=>{
        try{
            setLoading(true);

            const response=await fetch(API+"/api/auth/Logout",{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({refreshToken})
            });

            if(!response.ok) throw new Error("Failed to logout!");

            accessTokenRef.current="";
            navigate("/",{replace:true,state:null});
        }
        catch(err){
            setError(err.message);
        }
        finally{
            setLoading(false);
        }
    };

    if(!accessTokenRef.current) return <p>Please log in to access the admin dashboard.</p>;

    return (
        <div id="fullContainer">
            <div id="promptSender">
                <textarea id="promptArea" ref={promptRef} placeholder="Enter prompt!"/>

                <div id="injectDiv">
                    <h1 id="heading">ADMIN</h1>
                    <button id="injectButton" onClick={getResponse} disabled={loading}>
                        {loading?"Processing...":"Inject Prompt"}
                    </button>
                </div>
            </div>

            {error && <p role="alert" style={{color:"red"}}>{error}</p>}

            <div id="response">
                {Response||(loading?"Generating response...":"See Response Here!")}
            </div>

            <button id="downloadResponse" onClick={downloadResponse} disabled={loading||!Response}>
                Download Response
            </button>

            <button id="logout" onClick={logout} disabled={loading}>
                Logout
            </button>
        </div>
    );
}