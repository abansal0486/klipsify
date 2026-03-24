import React from "react";
import { X } from "lucide-react";

const ContactUs = ({ isOpen, onClose }) => {
  const [selectedSubject, setSelectedSubject] = React.useState("General Inquiry");

  if (!isOpen) return null;

  const inputStyle =
    "w-full p-3 rounded-sm text-xs placeholder:text-gray-300 placeholder:text-[10px] focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white shadow-sm border border-transparent text-gray-700 transition-all duration-300";
  const labelStyle = "block text-[10px] font-medium text-black mb-1 ml-1";

  const subjects = ["General Inquiry", "Support", "Partnership", "Other"];

  return (
    <div className="fixed inset-0 z-[100] min-h-screen flex items-start md:items-center justify-center px-4 overflow-y-auto pt-10 md:pt-0 pb-10 font-montserrat">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-transparent transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content Wrapper (White outer box) */}
      <div className="relative w-full max-w-[950px] bg-white rounded-[20px] md:pt-[60px] z-10 animate-in fade-in slide-in-from-bottom-8 duration-500 p-4 sm:p-6 md:p-7 shadow-2xl mt-4 md:mt-0">
        
        {/* Close Button X */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 md:top-6 md:right-6 lg:top-8 lg:right-8 p-1 md:p-[2px] border-[1.5px] md:border-2 border-black rounded-md hover:bg-gray-100 transition-colors z-20"
        >
          <X className="text-black stroke-[3px] w-3 h-3 md:w-[15px] md:h-[15px]" />
        </button>

        {/* Header */}
        <div className="text-center mb-4 md:mb-8 mt-2">
          <h2 className="text-xl md:text-[38px] font-bold text-black mb-3">
            Get in Touch
          </h2>
          <p className="text-gray-500 text-xs md:text-[14px] mx-auto">
            Have questions or need assistance? Send us a message — we're here to help.
          </p>
        </div>

        {/* Gradient Form Card */}
        <div 
          className="relative rounded-[10px] overflow-hidden p-4 sm:p-6 md:p-7 border-[1.5px] border-gray-700/80"
          style={{
            background: "linear-gradient(to bottom right, #FCF5F3, #F2F6FB, #F3EEF8)"
          }}
        >
          {/* Subtle multi-color background blobs to perfectly match the pastel ambiance */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_bottom_left,_#F6DED3_0%,_transparent_50%),_radial-gradient(circle_at_bottom_right,_#E9DFFA_0%,_transparent_50%),_radial-gradient(circle_at_top_right,_#D4EFFE_0%,_transparent_50%)] opacity-80" />

          <form onSubmit={(e) => e.preventDefault()} className="relative z-10 space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              {/* Full Name */}
              <div className="relative">
                <label className={labelStyle}>Full Name</label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  className={inputStyle}
                />
              </div>

              {/* Email */}
              <div className="relative">
                <label className={labelStyle}>Email*</label>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className={inputStyle}
                />
              </div>
            </div>

            {/* Select Subject */}
            <div>
              <p className={labelStyle}>Select Subject*</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {subjects.map((subject) => (
                  <label
                    key={subject}
                    className="flex items-center cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="subject"
                      value={subject}
                      className="hidden"
                      checked={selectedSubject === subject}
                      onChange={() => setSelectedSubject(subject)}
                    />
                    <div
                      className={`w-full py-2 px-2.5 bg-white rounded-lg transition-all duration-300 flex items-center gap-2 shadow-sm border border-transparent ${
                        selectedSubject === subject
                          ? "ring-2 ring-purple-200"
                          : ""
                      }`}
                    >
                      {/* Radio Circle */}
                      <div
                        className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center p-[2px] transition-colors ${
                          selectedSubject === subject
                            ? "border-gray-500"
                            : "border-gray-300 group-hover:border-gray-400"
                        }`}
                      >
                        <div
                          className={`w-full h-full rounded-full transition-all duration-300 ${
                            selectedSubject === subject
                              ? "bg-gray-400 opacity-100"
                              : "bg-transparent opacity-0"
                          }`}
                        />
                      </div>
                      <span
                        className="text-xs transition-colors text-gray-500 font-medium"
                      >
                        {subject}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className={labelStyle}>Message*</label>
              <textarea
                placeholder="Message"
                rows="3"
                className={`${inputStyle} resize-none`}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                className="w-full md:w-[200px] py-2.5 bg-gradient-to-r from-[#F472B6] to-[#A855F7] text-white font-medium rounded-full shadow-lg shadow-purple-200 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-300 text-xs"
              >
                Send Message
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;