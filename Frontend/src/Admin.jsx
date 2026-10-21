import { useRef, useState } from "react";
import {useLocation,useNavigate} from "react-router";
import "../styles/adminStyles.css";
export default function Admin() {
    const location =useLocation();
    const navigate=useNavigate();
    const [accessToken,setAccessToken]=useState(location.state?.accessToken);
    const refreshToken=location.state?.refreshToken;
    const promptRef = useRef(null);
    const [Response, setResponse] = useState("");

    const getResponse=async()=>{
    const prompt=promptRef.current.value.trim();

    if(!prompt){
        alert("Please enter a prompt!");
        return;
    }

    try{
        const headers={
            "Content-Type":"application/json",
            "Authorization":`Bearer ${accessToken}`
        };

        const response=await fetch('http://localhost:5299/api/admin/PromptToSQL',{
            method:"POST",
            headers,
            body:JSON.stringify({prompt})
        });

        console.log("PromptToSQL:",response.status);

        if(!response.ok){
            console.log(await response.text());
            throw new Error("PromptToSQL failed!");
        }

        const data=await response.json();
        console.log("PromptToSQL full response:",data);
        const query=data.response;

        console.log("Generated SQL:",query);

        const response1=await fetch('http://localhost:5299/api/admin/RunQuery',{
            method:"POST",
            headers,
            body:JSON.stringify({query})
        });

        console.log("RunQuery:",response1.status);

        if(!response1.ok){
            console.log(await response1.text());
            throw new Error("RunQuery failed!");
        }

        const data1=await response1.json();

        console.log("SQL Results:",data1);

        const response2=await fetch('http://localhost:5299/api/admin/SQLToText',{
            method:"POST",
            headers,
            body:JSON.stringify({
                prompt,
                sqlquery:query,
                queryoutput:JSON.stringify(data1)
            })
        });

        console.log("SQLToText:",response2.status);

        if(!response2.ok){
            console.log(await response2.text());
            throw new Error("SQLToText failed!");
        }

        const data2=await response2.json();
        console.log("PromptToSQL full response:",data2);
        setResponse(data2.response);
    }
    catch(err){
        console.error(err);
        alert(err.message);
    }
};

    const downloadResponse = () => {
        if (!Response) {
            alert("No response available to download!");
            return;
        }

        const blob = new Blob([Response], {
            type: "text/plain;charset=utf-8"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "adminResponse.txt";
        link.click();

        URL.revokeObjectURL(url);
    };
    const logout=async()=>{
        const response=await fetch('http://localhost:5299/api/auth/Logout',{
            method:"POST",
            headers:{
                "Content-Type":"application/json",
            },
            body:JSON.stringify({refreshToken:refreshToken})
        });
        if(response.ok){
            alert("Successfully Logged out!");
            navigate('/');
        }
        else{
            alert("Failed to logout!");
        }
    }
    return (
        <div id="fullContainer">
            <div id="promptSender">
                <textarea
                    id="promptArea"
                    ref={promptRef}
                    placeholder="Enter prompt!"
                />

                <div id="injectDiv">
                    <h1 id="heading">ADMIN</h1>
                    <button
                        id="injectButton"
                        onClick={getResponse}
                    >
                        Inject Prompt
                    </button>
                </div>
            </div>

            <div id="response">
                {Response || "See Response Here!"}
            </div>

            <button
                id="downloadResponse"
                onClick={downloadResponse}
            >
                Download Response
            </button>
            <button
                id="logout"
                onClick={logout}
            >
                Logout
            </button>
        </div>
    );
}
