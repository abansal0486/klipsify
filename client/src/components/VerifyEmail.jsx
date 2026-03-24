import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const navigate = useNavigate();
    const effectRan = useRef(false);

    const [status, setStatus] = useState("verifying"); // verifying, success, error
    const [message, setMessage] = useState("");

    useEffect(() => {
        // Prevent double execution in React 18 Strict Mode
        if (effectRan.current) return;
        effectRan.current = true;

        const verifyToken = async () => {
            if (!token) {
                setStatus("error");
                setMessage("Verification token is missing.");
                return;
            }

            try {
                const response = await api.post("/auth/verify-email", { token });
                setStatus("success");
                setMessage(response.data.message || "Email verified successfully!");
                // Optionally redirect to login after a delay
                setTimeout(() => {
                    navigate("/login");
                }, 5000);
            } catch (err) {
                setStatus("error");
                setMessage(err.response?.data?.message || "Email verification failed or link expired.");
            }
        };

        verifyToken();
    }, [token, navigate]);

    return (
        <section className="h-screen overflow-hidden bg-[#F8FAFC]">
            <div className="w-full h-full flex items-center justify-center p-5">
                <div className="bg-white w-full max-w-[480px] p-8 md:p-10 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center text-center">
                    <h1 className="text-2xl md:text-[32px] font-playfair font-bold mb-4">Email Verification</h1>

                    {status === "verifying" && (
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500 font-poppins">Verifying your email address, please wait...</p>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-green-600 font-medium mb-2 font-poppins">{message}</p>
                            <p className="text-gray-500 text-sm mb-6 font-poppins">You will be redirected to the login page shortly.</p>
                            <Link to="/login" className="bg-black text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all">
                                Go to Login
                            </Link>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <p className="text-red-600 font-medium mb-6 font-poppins">{message}</p>
                            <Link to="/register" className="bg-black text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all">
                                Try Registering Again
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default VerifyEmail;
