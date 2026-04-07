import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { forgotPassword, clearErrors, clearMessage } from "../redux/actions/authAction";
import { toast } from "react-toastify";

const ForgotPassword = () => {
    const dispatch = useDispatch();
    const { loading, error, message } = useSelector(state => state.auth);

    const [email, setEmail] = useState("");

    useEffect(() => {
        if (error) {
            toast.error(error, { toastId: error });
            dispatch(clearErrors());
        }
        if (message) {
            toast.success(message, { toastId: message });
            dispatch(clearMessage());
        }
    }, [error, message, dispatch]);

    const inputStyle = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-400 text-sm";
    const labelStyle = "text-sm font-montserrat text-black flex justify-start mb-2";

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(forgotPassword(email));
    };

    return (
        <section className="h-screen overflow-hidden bg-[#F8FAFC]">
            <div className="w-full h-full flex items-center justify-center p-5">
                <div className="bg-white w-full max-w-[480px] p-8 md:p-10 rounded-3xl shadow-xl border border-gray-100 flex flex-col">
                    <h1 className="text-2xl md:text-[32px] font-montserrat font-bold mb-2">Forgot Password?</h1>
                    <p className="text-gray-500 text-sm mb-6 font-montserrat">Enter your email and we'll send you instructions to reset your password.</p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-montserrat">
                        <div>
                            <label htmlFor="email" className={labelStyle}>Your Email</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="Enter your email address"
                                className={inputStyle}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`font-montserrat bg-black text-white text-[13px] px-4 mt-6 py-2.5 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all active:scale-95 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {loading ? "Sending..." : "Send Reset Link"}
                        </button>
                    </form>

                    <p className="text-center font-montserrat text-gray-500 mt-6 text-xs md:text-sm">
                        Remember your password? <Link to="/login" className="text-blue-600 hover:underline">Log in</Link>
                    </p>
                </div>
            </div>
        </section>
    );
};

export default ForgotPassword;
