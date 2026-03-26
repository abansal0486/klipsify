import { Routes, Route } from "react-router-dom";
import "./App.css";

import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Register from './pages/Register';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Success from './pages/Success';
import { Navigate } from 'react-router-dom';

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { loadUser } from "./redux/actions/authAction";

import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import AIGallery from "./pages/dashboard/AiGallary";
import PromptBar from "./components/PromptBar";
import UserProfile from "./pages/dashboard/UserProfile";
import MediaPreview from "./pages/dashboard/MediaPreview";
import BrandManager from "./pages/dashboard/BrandManager";
import Subscription from './pages/dashboard/Subscription';

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadUser());
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      /> */}

      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/subscription" element={<Subscription />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      >
        {/* default page */}
        <Route index element={<PromptBar />} />

        <Route path="gallery" element={<AIGallery />} />
        <Route path="profile" element={<UserProfile />} />
        <Route path="preview" element={<MediaPreview />} />
        <Route path="brand" element={<BrandManager />} />

        <Route path="subscription" element={<Subscription />} />
      </Route>

      <Route path="/success" element={<Success />} />
      <Route path="/cancel" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

