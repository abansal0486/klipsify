import { Link, useNavigate } from "react-router-dom";
import google from "../assets/google-icon.svg";
import { useState, useEffect } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { registerUser } from "../redux/actions/authAction";

const Register = () => {
    const inputStyle = "w-full p-2 font-poppins placeholder:text-[10px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-400 text-[12px]";
    const labelStyle = "text-sm text-sm  text-black font-poppins flex justify-start mb-1";

    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { loading, error, user } = useSelector((state) => state.auth);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [plan, setPlan] = useState("standard");
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState("");

    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError("");

        if (!name || !email || !password) {
            setLocalError("All fields are required");
            return;
        }

        if (!agreeToTerms) {
            setLocalError("You must agree to the terms and policy");
            return;
        }

        const userData = {
            name,
            email,
            password,
            plan
        };

        try {
            await dispatch(registerUser(userData));
            navigate('/dashboard');
        } catch (err) {
            // Error is handled by Redux state, but we catch to prevent uncaught promise errors
        }
    };

    return (
        <section className="h-screen overflow-hidden">
            <div className="w-full h-full  flex flex-col md:flex-row bg-[#F8FAFC]">
                {/** left side */}
                <div className="w-full md:w-1/2 flex items-center justify-center p-5 md:p-6">
                    <div className="bg-white w-full max-w-[480px] p-6 md:px-8 md:py-4 rounded-3xl shadow-xl border border-gray-100 flex flex-col">
                        <h1 className=" font-playfair text-lg md:text-2xl font-bold text-center mb-3">Let's get started</h1>

                        {localError && (
                            <div className="bg-red-50 text-red-600 text-[11px] p-2 rounded-lg mb-3 text-center border border-red-100">
                                {localError}
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 text-red-600 text-[11px] p-2 rounded-lg mb-3 text-center border border-red-100">
                                {error}
                            </div>
                        )}

                        <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="plan" className={labelStyle}>Select your plan</label>
                                <select
                                    id="plan"
                                    className={inputStyle}
                                    value={plan}
                                    onChange={(e) => setPlan(e.target.value)}
                                >
                                    <option value="standard">Standard Plan - $19/mo</option>
                                    <option value="premium">Premium Plan - $49/mo</option>
                                    <option value="enterprise">Free plan </option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="name" className={labelStyle}>Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    placeholder="Enter your full name"
                                    className={inputStyle}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className={labelStyle}>Your Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    placeholder="Enter your email"
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
                                        placeholder="Atleast 8 characters"
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

                            <div className="flex items-center gap-2 mt-3">
                                <input
                                    type="checkbox"
                                    className="cursor-pointer"
                                    id="terms"
                                    checked={agreeToTerms}
                                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                                />
                                <label htmlFor="terms" className="text-sm cursor-pointer text-[10px]">
                                    I agree to the <span className="text-blue-600">terms</span> and <span className="text-blue-600">Policy</span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`bg-black font-poppins text-white text-[13px] px-4 mt-5 py-2 rounded-full shadow-lg hover:bg-gray-800 transition-all active:scale-95 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                {loading ? "Creating..." : "Start free"}
                            </button>
                        </form>

                        <button className="bg-white border font-poppins border-gray-300 text-black text-[13px] px-4 mt-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-95">
                            <img className="w-5 h-5" src={google} alt="Google" /> Continue with Google
                        </button>
                        <p className="text-center text-gray-500 mt-3 font-poppins text-sm">
                            Already have an account? <Link to="/login" className="text-blue-600  hover:underline">Log in</Link>
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

export default Register;
