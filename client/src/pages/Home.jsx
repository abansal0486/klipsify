import React, { useState } from "react";
import Header from "../components/Header";
import Hero from "../components/Hero";
import ConnectedPlatforms from "../components/ConnectedPlatforms";
import AboutFeatures from "../components/AboutFeatures";
import Pricing from "../components/Pricing";
import RatingSection from "../components/RatingSection";
import Footer from "../components/Footer";
import ContactUs from "../components/ContactUs";

const HomePage = () => {
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <div id="home" className="bg-white overflow-x-hidden">
      <Header onContactClick={() => setIsContactOpen(true)} />
      <Hero />
      <ConnectedPlatforms />
      <RatingSection />
      <AboutFeatures />
      <Pricing />
      <Footer onContactClick={() => setIsContactOpen(true)} />

      <ContactUs
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </div>
  );
};

export default HomePage;