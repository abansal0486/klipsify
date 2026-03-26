import { Link, useNavigate } from "react-router-dom";
import google from "../assets/google-icon.svg";
import { useState, useEffect } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../redux/actions/authAction";

const Login = () => {
    const inputStyle = "w-full p-2 border border-gray-300 placeholder:text-[10px] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-400 text-sm";
    const labelStyle = "text-sm font-poppins  text-black flex justify-start mb-1";

    const dispatch = useDispatch();
    const navigate = useNavigate();

   const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
   const loading = useSelector((state) => state.auth.loading);
   const error = useSelector((state) => state.auth.error);


    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState("");

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/dashboard");
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError("");

        if (!email || !password) {
            setLocalError("Email and password are required");
            return;
        }

        const userData = {
            email,
            password
        };

        try {
            await dispatch(loginUser(userData));
        } catch (err) {
            // Error is handled in Redux state
        }
    };

    return (
        <section className="h-screen overflow-hidden">
            <div className="w-full md:h-full  flex flex-col md:flex-row">
                {/** left side */}
                <div className="w-full md:w-1/2 flex items-center justify-center p-5">
                    <div className="bg-white w-full max-w-[480px] p-8 md:p-10 rounded-3xl shadow-xl border border-gray-100 flex flex-col">
                        <h1 className="text-2xl md:text-[32px] font-playfair font-bold  mb-6">Welcome back</h1>

                        {localError && (
                            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg mb-4 text-center border border-red-100">
                                {localError}
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg mb-4 text-center border border-red-100">
                                {error}
                            </div>
                        )}

                        <form className="flex flex-col gap-4 font-poppins" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="email" className={labelStyle}>Your Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    placeholder="Enter your email address"
                                    className={inputStyle}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="relative">
                                <label htmlFor="password" className={labelStyle}>Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        placeholder="Enter your password"
                                        className={inputStyle}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 transition-colors"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-1 px-1">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="cursor-pointer" id="remember" />
                                    <label htmlFor="remember" className="text-[10px] cursor-pointer text-gray-600 font-poppins">
                                        Remember me
                                    </label>
                                </div>
                                <Link to="/forgot-password" title="Click to reset password" className="text-[10px] cursor-pointer text-blue-600 hover:underline font-poppins">
                                    Forgot password?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`font-poppins bg-black text-white text-[13px] px-4 mb-2 mt-4 py-2.5 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all active:scale-95 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                {loading ? "Logging in..." : "Login"}
                            </button>
                        </form>

                        <div className="flex items-center justify-center gap-2 mt-2">
                            <hr className="w-full border-gray-200" />
                            <p className="text-[10px] font-poppins text-gray-400">Or</p>
                            <hr className="w-full border-gray-200" />
                        </div>

                        <button className=" font-poppins bg-white border border-gray-300 font-medium text-black text-[13px] px-4 mt-4 py-2.5 rounded-full  shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-95">
                            <img className="w-5 h-5" src={google} alt="Google" /> Sign In with Google
                        </button>

                        <p className="text-center font-poppins text-gray-500 mt-4 text-sm">
                            Don't have an account? <Link to="/register" className="text-blue-600  hover:underline">Register now</Link>
                        </p>
                    </div>
                </div>
                {/** right side */}
                <div className="hidden md:block rounded-l-3xl w-1/2 bg-black relative overflow-hidden">
                </div>
            </div>
        </section>
    );
};

export default Login;
