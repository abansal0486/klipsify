import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, Home } from 'lucide-react';

const Success = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');

    // Automatically redirect after 10 seconds if user doesn't click
    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/dashboard');
        }, 10000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] relative overflow-hidden font-poppins px-4">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-[#E30BEB] opacity-5 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#1869CC] opacity-5 blur-[120px] rounded-full"></div>

            <div className="max-w-md w-full bg-white rounded-[24px] shadow-2xl p-8 md:p-12 text-center relative z-10 border border-white/20 backdrop-blur-sm">
                {/* Success Icon with Glow */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-[#10B981] opacity-20 blur-2xl rounded-full scale-125 mx-auto w-24 h-24"></div>
                    <div className="relative bg-[#10B981] w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
                        <CheckCircle size={48} className="text-white" />
                    </div>
                </div>

                {/* Text Content */}
                <h1 className="text-3xl font-bold text-[#1A1842] mb-4 font-playfair">
                    Payment Successful!
                </h1>
                <p className="text-[#64748B] text-lg mb-8 leading-relaxed">
                    Thank you for your purchase. Your account limits have been updated and you're ready to create.
                </p>

                {/* Order Details (if available) */}
                {sessionId && (
                    <div className="bg-[#F1F5F9] rounded-[16px] p-4 mb-8">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-[#94A3B8] mb-1">
                            Session ID
                        </p>
                        <p className="text-[12px] font-mono text-[#475569] break-all">
                            {sessionId}
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="w-full bg-[#742AFE] hover:bg-[#6366F1] text-white py-4 rounded-[16px] font-bold text-lg transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-indigo-100"
                    >
                        Go to Dashboard <ArrowRight size={20} />
                    </button>
                    
                    <button 
                        onClick={() => navigate('/')}
                        className="w-full bg-transparent text-[#64748B] hover:text-[#1A1842] py-2 rounded-[16px] font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        <Home size={16} /> Return Home
                    </button>
                </div>

                {/* Footer Message */}
                <p className="mt-8 text-[11px] text-[#94A3B8]">
                    A confirmation email has been sent to your inbox. <br />
                    Redirecting you to the dashboard in 10 seconds...
                </p>
            </div>
        </div>
    );
};

export default Success;
