import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import AdminPanel from "./AdminPanel";
import LoginPage from "./LoginPage";
import PharmacyDashboard from "./PharmacyDashboard";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pharmacy-dashboard" element={<PharmacyDashboard />} />
      </Routes>
    </Router>
  </React.StrictMode>,
);
