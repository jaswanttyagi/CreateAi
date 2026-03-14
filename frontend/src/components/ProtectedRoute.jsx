import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { UserDataContext } from "../ContextApi/Usercontext";

const ProtectedRoute = ({ children }) => {
  const { userData } = useContext(UserDataContext);

  if (!userData) {
    return <Navigate to="/signup" replace />;
  }

  return children;
};

export default ProtectedRoute;
