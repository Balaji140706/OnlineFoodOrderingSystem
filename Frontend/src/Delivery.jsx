import {useState,useEffect,useCallback,useRef} from 'react';
import {useLocation,useNavigate} from 'react-router';
import '../styles/deliveryStyles.css';

const API='http://localhost:5299';

export default function Delivery(){
    const location=useLocation(),navigate=useNavigate();
    const [accessToken,setAccessToken]=useState(location.state?.accessToken??'');
    const refreshToken=location.state?.refreshToken;
    const accessTokenRef=useRef(accessToken),refreshPromiseRef=useRef(null);
    const [delivery,setDelivery]=useState({name:'',phoneno:'',email:'',zoneofoperation:'',rating:0,ordercount:0});
    const [draft,setDraft]=useState(null);
    const [availabilitystatus,setAvailabilitystatus]=useState('offline');
    const [orders,setOrders]=useState([]);
    const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[refreshing,setRefreshing]=useState(false);
    const [statusSaving,setStatusSaving]=useState(false),[completingId,setCompletingId]=useState(null);
    const [errorMessage,setErrorMessage]=useState('');
    const [selectedOrderId,setSelectedOrderId]=useState(null),[orderItems,setOrderItems]=useState([]),[itemsLoading,setItemsLoading]=useState(false);

    const apiRequest=useCallback(async(endpoint,options={})=>{
        const send=token=>fetch(`${API}${endpoint}`,{...options,headers:{...(options.body!==undefined?{'Content-Type':'application/json'}:{}),...options.headers,Authorization:`Bearer ${token}`}});
        let response=await send(accessTokenRef.current);
        if(response.status===401){
            if(!refreshToken) throw new Error('Session expired. Please log in again.');
            if(!refreshPromiseRef.current){
                refreshPromiseRef.current=(async()=>{
                    const r=await fetch(`${API}/api/auth/RefreshToken`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken})});
                    if(!r.ok) throw new Error('Session expired. Please log in again.');
                    const data=await r.json();
                    if(!data.accessToken) throw new Error('Could not refresh access token.');
                    accessTokenRef.current=data.accessToken;
                    setAccessToken(data.accessToken);
                    return data.accessToken;
                })().finally(()=>{refreshPromiseRef.current=null;});
            }
            response=await send(await refreshPromiseRef.current);
        }
        if(!response.ok){
            const data=await response.json().catch(()=>null);
            throw new Error(data?.message||`Request failed (${response.status})`);
        }
        return response.status===204?null:response.json();
    },[refreshToken]);

    const fetchDelivery=useCallback(async()=>{
        const data=await apiRequest('/api/delivery/DeliveryDetails');
        setDelivery(prev=>({...prev,name:data.name??'',phoneno:data.phoneno??'',email:data.email??'',zoneofoperation:data.zoneofoperation??''}));
    },[apiRequest]);
    const fetchStatistics=useCallback(async()=>{
        const data=await apiRequest('/api/delivery/DeliveryStatistics');
        setDelivery(prev=>({...prev,rating:data.rating??0,ordercount:data.ordercount??0}));
    },[apiRequest]);
    const fetchAssignedOrders=useCallback(async()=>{
        const data=await apiRequest('/api/delivery/AssignedOrders');
        if(!Array.isArray(data)) throw new Error('Invalid assigned orders response.');
        setOrders(data);
    },[apiRequest]);
    const fetchStatus=useCallback(async()=>{
        const data=await apiRequest('/api/delivery/DeliveryStatus');
        setAvailabilitystatus(data.availabilitystatus);
    },[apiRequest]);
    const refreshDashboard=useCallback(async()=>{
        await Promise.all([fetchAssignedOrders(),fetchStatistics(),fetchStatus()]);
    },[fetchAssignedOrders,fetchStatistics,fetchStatus]);

    useEffect(()=>{
        if(!accessTokenRef.current){setLoading(false);return;}
        let active=true;
        Promise.all([fetchDelivery(),refreshDashboard()]).then(()=>{if(active)setErrorMessage('');}).catch(err=>{if(active)setErrorMessage(err.message);}).finally(()=>{if(active)setLoading(false);});
        return ()=>{active=false;};
    },[fetchDelivery,refreshDashboard]);

    const saveDetails=async()=>{
        if(!draft.name.trim()||!String(draft.phoneno).trim()||!draft.email.trim()||!draft.zoneofoperation.trim()) return alert('Please fill all the details.');
        try{
            setSaving(true);
            await apiRequest('/api/delivery/UpdateDeliveryDetails',{method:'PUT',body:JSON.stringify(draft)});
            await fetchDelivery();
            setDraft(null);
            alert('Delivery details updated successfully!');
        }catch(err){alert(err.message);}finally{setSaving(false);}
    };
    const updateStatus=async()=>{
        if(availabilitystatus==='busy') return;
        const next=availabilitystatus==='available'?'offline':'available';
        try{
            setStatusSaving(true);
            await apiRequest('/api/delivery/UpdateDeliveryStatus',{method:'PUT',body:JSON.stringify({availabilitystatus:next})});
            await fetchStatus();
        }catch(err){alert(err.message);await fetchStatus().catch(()=>{});}finally{setStatusSaving(false);}
    };
    const refreshOrders=async()=>{
        try{
            setRefreshing(true);
            await refreshDashboard();
            setSelectedOrderId(null);setOrderItems([]);setErrorMessage('');
        }catch(err){setErrorMessage(err.message);}finally{setRefreshing(false);}
    };
    const viewOrderItems=async(orderid)=>{
        if(selectedOrderId===orderid){setSelectedOrderId(null);setOrderItems([]);return;}
        try{
            setItemsLoading(true);setSelectedOrderId(orderid);setOrderItems([]);
            const data=await apiRequest('/api/delivery/OrderItems',{method:'POST',body:JSON.stringify({orderid})});
            if(!Array.isArray(data)) throw new Error('Invalid order items response.');
            setOrderItems(data);
        }catch(err){alert(err.message);setSelectedOrderId(null);}finally{setItemsLoading(false);}
    };
    const completeOrder=async(orderid)=>{
        if(!window.confirm(`Mark order #${orderid} as fulfilled?`)) return;
        try{
            setCompletingId(orderid);
            await apiRequest('/api/delivery/CompleteOrder',{method:'PUT',body:JSON.stringify({orderid})});
            await refreshDashboard();
            setSelectedOrderId(null);setOrderItems([]);setErrorMessage('');
            alert('Order completed successfully!');
        }catch(err){alert(err.message);await refreshDashboard().catch(()=>{});}finally{setCompletingId(null);}
    };
    const logout=async()=>{
        try{
            setSaving(true);
            await apiRequest('/api/auth/Logout',{method:'POST',body:JSON.stringify({refreshToken})});
            accessTokenRef.current='';setAccessToken('');
            navigate('/',{replace:true,state:null});
        }catch(err){alert(err.message);}finally{setSaving(false);}
    };

    if(!accessToken) return <p>Please log in to access the delivery dashboard.</p>;
    if(loading) return <p>Loading delivery dashboard...</p>;
    return <div id="Delivery_div">
        <h1 id="Delivery_heading">Delivery Person Page</h1>
        {errorMessage&&<p role="alert">{errorMessage}</p>}

        <div className="Delivery_section">
            <h2>Delivery Person Details</h2>
            {[
                ['name','Name','text'],['phoneno','Phone Number','tel'],['email','Email','email'],['zoneofoperation','Zone of Operation','text']
            ].map(([field,label,type])=><div className="Delivery_field" key={field}>
                <label htmlFor={`delivery_${field}`}>{label}:</label>
                <input id={`delivery_${field}`} name={field} type={type} value={(draft??delivery)[field]} disabled={!draft||saving} onChange={e=>setDraft(prev=>({...prev,[field]:e.target.value}))}/>
            </div>)}
            {draft?<div className="Delivery_actions">
                <button className="Delivery_button" onClick={saveDetails} disabled={saving}>{saving?'SAVING...':'SAVE DETAILS'}</button>
                <button className="Delivery_button" onClick={()=>setDraft(null)} disabled={saving}>CANCEL</button>
            </div>:<button className="Delivery_button" onClick={()=>setDraft({name:delivery.name,phoneno:delivery.phoneno,email:delivery.email,zoneofoperation:delivery.zoneofoperation})}>UPDATE DETAILS</button>}
        </div>

        <div className="Delivery_section">
            <h2>Delivery Availability</h2>
            <p><strong>Current Status: </strong>{availabilitystatus.toUpperCase()}</p>
            {availabilitystatus==='busy'?<p>You have an active delivery. Your status cannot be changed until it is completed or cancelled.</p>:<button className="Delivery_button" onClick={updateStatus} disabled={statusSaving}>
                {statusSaving?'UPDATING...':availabilitystatus==='available'?'GO OFFLINE':'GO AVAILABLE'}
            </button>}
        </div>

        <div className="Delivery_section">
            <h2>Delivery Statistics</h2>
            <p><strong>Total Orders Completed: </strong>{delivery.ordercount}</p>
            <p><strong>Average Rating: </strong>{Number(delivery.rating??0).toFixed(1)} / 5</p>
        </div>

        <div className="Delivery_section">
            <h2>Assigned Orders</h2>
            {orders.length===0?<p>No pending orders assigned yet.</p>:<div className="Delivery_tableWrapper"><table className="Delivery_table">
                <thead><tr><th>Order ID</th><th>Restaurant</th><th>Pickup Address</th><th>Customer</th><th>Delivery Address</th><th>Customer Phone</th><th>Amount</th><th>Status</th><th>Items</th><th>Action</th></tr></thead>
                <tbody>{orders.map(order=><tr key={order.orderid}>
                    <td>{order.orderid}</td><td>{order.restaurantname}</td><td>{order.restaurantaddress}</td><td>{order.customername}</td><td>{order.customeraddress}</td><td>{order.customerphone}</td>
                    <td>₹{Number(order.totalamount).toFixed(2)}</td><td>{order.status}</td>
                    <td><button className="Delivery_tableButton" disabled={itemsLoading} onClick={()=>viewOrderItems(order.orderid)}>{selectedOrderId===order.orderid?'HIDE ITEMS':'VIEW ITEMS'}</button></td>
                    <td><button className="Delivery_tableButton" disabled={completingId!==null} onClick={()=>completeOrder(order.orderid)}>{completingId===order.orderid?'COMPLETING...':'COMPLETE ORDER'}</button></td>
                </tr>)}</tbody>
            </table></div>}
            {selectedOrderId!==null&&<div className="Delivery_section">
                <h3>Items for Order #{selectedOrderId}</h3>
                {itemsLoading?<p>Loading order items...</p>:orderItems.length===0?<p>No items found for this order.</p>:<table className="Delivery_table">
                    <thead><tr><th>Item</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
                    <tbody>{orderItems.map((item,index)=><tr key={index}><td>{item.name}</td><td>{item.quantity}</td><td>₹{Number(item.unitprice).toFixed(2)}</td><td>₹{(Number(item.unitprice)*Number(item.quantity)).toFixed(2)}</td></tr>)}</tbody>
                </table>}
            </div>}
        </div>

        <button className="Delivery_button" onClick={refreshOrders} disabled={refreshing||saving||completingId!==null}>{refreshing?'REFRESHING...':'REFRESH'}</button>
        <button className="Delivery_button" onClick={logout} disabled={saving}>LOGOUT</button>
    </div>;
}
