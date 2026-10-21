import db from '../config/db.js';

export function RestaurantDetailsController(req,res){
    const {id}=req.user;
    db.query('select name,phoneno,email,address from restaurant where id=?',[id],(err,rows)=>{
        if(err) return res.status(500).json({message:"Could not fetch restaurant details!"});
        if(!rows.length) return res.status(404).json({message:"Restaurant not found!"});
        return res.status(200).json(rows[0]);
    });
}

export function UpdateRestaurantDetailsController(req,res){
    const {id}=req.user;
    const {name,phoneno,email,address}=req.body;
    if(!name?.trim() || !String(phoneno??"").trim() || !email?.trim() || !address?.trim()) return res.status(400).json({message:"Invalid restaurant details!"});

    db.query('update restaurant set name=?,phoneno=?,email=?,address=? where id=?',[name.trim(),phoneno,email.trim(),address.trim(),id],(err,result)=>{
        if(err) return res.status(500).json({message:"Could not update restaurant details!"});
        if(!result.affectedRows) return res.status(404).json({message:"Restaurant not found!"});
        return res.status(204).send();
    });
}

export function GetMenuItemsController(req,res){
    const {id}=req.user;
    db.query('select id,name,price from menuitems where restaurantid=?',[id],(err,rows)=>{
        if(err) return res.status(500).json({message:"Could not fetch menu!"});
        return res.status(200).json(rows);
    });
}

export function AddItemToMenuController(req,res){
    const {id}=req.user;
    const {itemname,itemprice}=req.body;
    if(typeof itemname!=="string" || !itemname.trim() || itemprice==null || itemprice==="" || !Number.isFinite(Number(itemprice)) || Number(itemprice)<0) return res.status(422).json({message:"Invalid item name or price!"});

    db.query('insert into menuitems (restaurantid,name,price) values (?,?,?)',[id,itemname.trim(),Number(itemprice)],(err,result)=>{
        if(err) return res.status(500).json({message:"Could not add new item to menu!"});
        return res.status(201).json({message:"Successfully added new item!",itemId:result.insertId});
    });
}

export function EditMenuItemController(req,res){
    const {id}=req.user;
    const {itemid,newname,newprice}=req.body;
    if(!Number.isSafeInteger(Number(itemid)) || Number(itemid)<=0 || typeof newname!=="string" || !newname.trim() || newprice==null || newprice==="" || !Number.isFinite(Number(newprice)) || Number(newprice)<0) return res.status(422).json({message:"Invalid menu item details!"});

    db.query('update menuitems set name=?,price=? where id=? and restaurantid=?',[newname.trim(),Number(newprice),itemid,id],(err,result)=>{
        if(err) return res.status(500).json({message:"Could not edit menu item!"});
        if(!result.affectedRows) return res.status(404).json({message:"Menu item not found!"});
        return res.status(204).send();
    });
}

export function DeleteMenuItemController(req,res){
    const {id}=req.user;
    const {itemid}=req.body;
    if(!Number.isSafeInteger(Number(itemid)) || Number(itemid)<=0) return res.status(422).json({message:"Invalid menu item ID!"});

    db.query('delete from menuitems where id=? and restaurantid=?',[itemid,id],(err,result)=>{
        if(err){
            if(err.code==="ER_ROW_IS_REFERENCED_2") return res.status(409).json({message:"Item belongs to previous orders and cannot be deleted!"});
            return res.status(500).json({message:"Could not delete menu item!"});
        }
        if(!result.affectedRows) return res.status(404).json({message:"Menu item not found!"});
        return res.status(204).send();
    });
}

export function RestaurantStatusController(req,res){
    const {id}=req.user;
    db.query('select availabilitystatus from restaurant where id=?',[id],(err,rows)=>{
        if(err) return res.status(500).json({message:"Could not fetch restaurant status!"});
        if(!rows.length) return res.status(404).json({message:"Restaurant not found!"});
        return res.status(200).json(rows[0]);
    });
}

export function UpdateRestaurantStatusController(req,res){
    const {id}=req.user;
    const {restaurantstatus}=req.body;
    if(!["available","offline"].includes(restaurantstatus)) return res.status(400).json({message:"Invalid restaurant status!"});

    db.query('update restaurant set availabilitystatus=? where id=? and isactive=1',[restaurantstatus,id],(err,result)=>{
        if(err) return res.status(500).json({message:"Could not update restaurant status!"});
        if(!result.affectedRows) return res.status(404).json({message:"Restaurant not found or inactive!"});
        return res.status(204).send();
    });
}

export function RestaurantOrdersController(req,res){
    const {id}=req.user;
    db.query('select o.id as orderid,c.name as customername,c.address as customeraddress,c.phoneno as customerphone,o.price as totalamount,o.paymentmethod,o.status,o.createdon from orders o join customer c on o.customerid=c.id where o.restaurantid=? order by o.createdon desc',[id],(err,rows)=>{
        if(err) return res.status(500).json({message:"Could not fetch restaurant orders!"});
        return res.status(200).json(rows);
    });
}

export function RestaurantOrderItemsController(req,res){
    const {id}=req.user;
    const {orderid}=req.body;
    if(!Number.isSafeInteger(Number(orderid)) || Number(orderid)<=0) return res.status(400).json({message:"Invalid order ID!"});

    db.query('select m.name,oi.quantity,oi.unitprice from orders o join orderitems oi on oi.orderid=o.id join menuitems m on m.id=oi.menuitemid where o.id=? and o.restaurantid=?',[orderid,id],(err,rows)=>{
        if(err) return res.status(500).json({message:"Could not fetch order items!"});
        return res.status(200).json(rows);
    });
}