import db from '../config/db.js';
export function DeliveryDetailsController(req,res){
    const {id}=req.user;
    db.query('select name,phoneno,email,zoneofoperation from Delivery where id=?',[id],(err1,res1)=>{
        if(err1){
            return res.status(500).json({message:"Could not fetch details!"});
        }
        if (res1.length === 0) {
            return res.status(404).json({
                message: "Delivery partner not found!"
            });
        }
        return res.status(200).json(res1[0]);
    });
}
export function UpdateDeliveryDetailsController(req,res){
    const {id}=req.user;
    const {name,phoneno,email,zoneofoperation}=req.body;
    db.query('update delivery set name=?,phoneno=?,email=?,zoneofoperation=? where id=?',[name,phoneno,email,zoneofoperation,id],(err1)=>{
        if(err1){
            return res.status(500).json({message:"Could not update details!"});
        }
        return res.status(204).send();
    });
}
export function DeliveryStatisticsController(req,res){
    const {id}=req.user;
    db.query('select rating,ordercount from Delivery where id=?',[id],(err1,res1)=>{
        if(err1){
            return res.status(500).json({message:"Could not fetch delivery statistics!"});
        }
        if (res1.length === 0) {
            return res.status(404).json({
                message: "Delivery partner not found!"
            });
        }
        return res.status(200).json(res1[0]);
    });
}
export function AssignedOrdersController(req,res){
    const {id}=req.user;
    db.query('select o.id as orderid,r.name as restaurantname,r.address as restaurantaddress,c.name as customername,c.address as customeraddress,c.phoneno as customerphone,o.price as totalamount,o.status from orders o join restaurant r on o.restaurantid=r.id join customer c on o.customerid=c.id where o.status="pending" and o.deliverypersonid=?',[id],(err,res1)=>{
        if(err) return res.status(500).json({message:"Could not fetch pending orders!"});
        return res.status(200).json(res1);
    });
}

export function DeliveryStatusController(req,res){
    const {id}=req.user;
    db.query('select availabilitystatus from delivery where id=?',[id],(err,res1)=>{
        if(err) return res.status(500).json({message:"Could not fetch delivery status!"});
        if(!res1.length) return res.status(404).json({message:"Delivery partner not found!"});
        return res.status(200).json(res1[0]);
    });
}

export async function UpdateDeliveryStatusController(req,res){
    const {id}=req.user;
    const {availabilitystatus}=req.body;
    if(!["available","offline"].includes(availabilitystatus)) return res.status(400).json({message:"Invalid delivery status!"});

    let conn;
    try{
        conn=await db.promise().getConnection();
        await conn.beginTransaction();

        const [partners]=await conn.query('select availabilitystatus from delivery where id=? for update',[id]);
        if(!partners.length){
            await conn.rollback();
            return res.status(404).json({message:"Delivery partner not found!"});
        }

        const [orders]=await conn.query('select id from orders where deliverypersonid=? and status="pending" limit 1',[id]);
        if(partners[0].availabilitystatus==="busy" || orders.length){
            await conn.rollback();
            return res.status(409).json({message:"Cannot change status while handling an order!"});
        }

        await conn.query('update delivery set availabilitystatus=? where id=?',[availabilitystatus,id]);
        await conn.commit();
        return res.status(204).send();
    }
    catch(err){
        console.error(err);
        if(conn) await conn.rollback().catch(console.error);
        return res.status(500).json({message:"Could not update delivery status!"});
    }
    finally{
        if(conn) conn.release();
    }
}
export async function CompleteOrderController(req,res){
    const {id}=req.user;
    const {orderid}=req.body;
    let conn;
    try{
        conn=await db.promise().getConnection();
        await conn.beginTransaction();

        const [partners]=await conn.query('select id from delivery where id=? for update',[id]);
        if(!partners.length){
            await conn.rollback();
            return res.status(404).json({message:"Delivery partner not found!"});
        }

        const [orders]=await conn.query('select id,status from orders where id=? and deliverypersonid=? for update',[orderid,id]);
        if(!orders.length || orders[0].status!=="pending"){
            await conn.rollback();
            return res.status(409).json({message:"Order cannot be completed!"});
        }

        await conn.query('update orders set status="fulfilled" where id=?',[orderid]);
        await conn.query('update delivery set availabilitystatus="available",ordercount=ordercount+1 where id=?',[id]);

        await conn.commit();
        return res.status(204).send();
    }
    catch(err){
        console.error(err);
        if(conn) await conn.rollback().catch(console.error);
        return res.status(500).json({message:"Could not complete order!"});
    }
    finally{
        if(conn) conn.release();
    }
}
export function OrderItemsController(req,res){
    const {id}=req.user;
    const {orderid}=req.body;

    if(!Number.isSafeInteger(Number(orderid)) || Number(orderid)<=0) return res.status(400).json({message:"Invalid order ID!"});

    db.query('select m.name,oi.quantity,oi.unitprice from orders o join orderitems oi on oi.orderid=o.id join menuitems m on oi.menuitemid=m.id where o.id=? and o.deliverypersonid=?',[orderid,id],(err,rows)=>{
        if(err){
            console.error(err);
            return res.status(500).json({message:"Could not fetch order items!"});
        }
        return res.status(200).json(rows);
    });
}