import React, { useContext } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { UserDataContext } from "./ContextApi/Usercontext";
import ProtectedRoute from "./components/ProtectedRoute";
import Customize from "./pages/Customize";
import Loginpage from "./pages/Loginpage";
import Signpage from "./pages/Signpage";
import Customzize2 from "./pages/Customzize2";
import Home from "./pages/Home";

function App() {
  const { userData } = useContext(UserDataContext);
  const location = useLocation();
  const hasAssistantProfile = Boolean(
    userData?.assistantName && userData?.assistantImage
  );
  const isEditingAssistant = Boolean(location.state?.allowAssistantCustomization);
  const authenticatedRedirectPath = hasAssistantProfile ? "/" : "/customize";
  const canAccessCustomization = !hasAssistantProfile || isEditingAssistant;
  const customizationElement = canAccessCustomization ? (
    <Customize />
  ) : (
    <Navigate to="/" replace />
  );
  const customizationStepTwoElement = canAccessCustomization ? (
    <Customzize2 />
  ) : (
    <Navigate to="/" replace />
  );

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {hasAssistantProfile ? <Home /> : <Navigate to="/customize" replace />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/signup"
        element={userData ? <Navigate to={authenticatedRedirectPath} replace /> : <Signpage />}
      />
      <Route
        path="/login"
        element={userData ? <Navigate to={authenticatedRedirectPath} replace /> : <Loginpage />}
      />
      <Route
        path="/customize"
        element={
          <ProtectedRoute>
            {customizationElement}
          </ProtectedRoute>
        }
      />
      <Route
        path="/customize2"
        element={
          <ProtectedRoute>
            {customizationStepTwoElement}
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to={userData ? authenticatedRedirectPath : "/signup"} replace />}
      />
    </Routes>
  );
}

export default App;
