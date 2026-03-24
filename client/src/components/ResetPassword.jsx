import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { resetPassword, clearErrors, clearMessage } from "../redux/actions/authAction";

const ResetPassword = () => {
    const dispatch = useDispatch();
    const { loading, error, message } = useSelector(state => state.auth);

    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState("");

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                navigate("/login");
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [message, navigate]);

    useEffect(() => {
        return () => {
            dispatch(clearErrors());
            dispatch(clearMessage());
        };
    }, [dispatch]);

    const inputStyle = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-400 text-sm";
    const labelStyle = "text-sm font-poppins text-black flex justify-start mb-2";

    const handleSubmit = (e) => {
        e.preventDefault();
        setLocalError("");

        if (!token) {
            setLocalError("Invalid or missing reset token.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setLocalError("Passwords do not match.");
            return;
        }

        dispatch(resetPassword(token, { newPassword }));
    };

    return (
        <section className="h-screen overflow-hidden bg-[#F8FAFC]">
            <div className="w-full h-full flex items-center justify-center p-5">
                <div className="bg-white w-full max-w-[480px] p-8 md:p-10 rounded-3xl shadow-xl border border-gray-100 flex flex-col">
                    <h1 className="text-2xl md:text-[32px] font-playfair font-bold mb-2">Create New Password</h1>
                    <p className="text-gray-500 text-sm mb-6 font-poppins">Enter your new secure password below.</p>

                    {message && (
                        <div className="bg-green-50 text-green-600 text-xs p-3 rounded-lg mb-4 text-center border border-green-100 italic">
                            {message}
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg mb-4 text-center border border-red-100">
                            {error}
                        </div>
                    )}
                    {localError && (
                        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg mb-4 text-center border border-red-100">
                            {localError}
                        </div>
                    )}

                    {!token && !message && (
                        <div className="bg-yellow-50 text-yellow-700 text-xs p-3 rounded-lg mb-4 text-center border border-yellow-100">
                            Warning: Reset token is missing from the URL. This request may fail.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-poppins">
                        <div className="relative">
                            <label htmlFor="newPassword" className={labelStyle}>New Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="newPassword"
                                    placeholder="Enter new password"
                                    className={inputStyle}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 transition-colors"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className={labelStyle}>Confirm New Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                placeholder="Re-enter new password"
                                className={inputStyle}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || message}
                            className={`font-poppins bg-black text-white text-[13px] px-4 mt-6 py-2.5 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all active:scale-95 ${loading || message ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {loading ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>

                    <p className="text-center font-poppins text-gray-500 mt-6 text-sm">
                        Back to <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
                    </p>
                </div>
            </div>
        </section>
    );
};

export default ResetPassword;
