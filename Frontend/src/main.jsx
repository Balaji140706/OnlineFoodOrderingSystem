import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router';
import Login from './Login';

import Customer from './Customer.jsx';
import Restaurant from './Restaurant.jsx';
import Delivery from './Delivery.jsx';
import Admin from './Admin.jsx';

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<Login/>}/>
            <Route path="/Customer" element={<Customer/>}/>
            <Route path="/Restaurant" element={<Restaurant/>}/>
            <Route path="/Delivery" element={<Delivery/>}/>
            <Route path="/Admin" element={<Admin/>}/>
        </Routes>
    </BrowserRouter>
);
