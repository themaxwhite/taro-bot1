import { Atmosphere } from "./components/Atmosphere";
import { Silhouettes } from "./components/Silhouettes";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Spreads } from "./components/Spreads";
import { Readings } from "./components/Readings";
import { DrawCard } from "./components/DrawCard";
import { HowItWorks } from "./components/HowItWorks";
import { Deck } from "./components/Deck";
import { Testimonials } from "./components/Testimonials";
import { Features } from "./components/Features";
import { Stars } from "./components/Stars";
import { Faq } from "./components/Faq";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="relative">
      <Silhouettes />
      <Atmosphere />
      <div className="relative z-10">
        <Nav />
        <main>
          <Hero />
          <Spreads />
          <Readings />
          <DrawCard />
          <HowItWorks />
          <Deck />
          <Testimonials />
          <Features />
          <Stars />
          <Faq />
        </main>
        <Footer />
      </div>
    </div>
  );
}
