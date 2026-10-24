import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Book from "./pages/Book";
import { About, Areas, Contact, Faq, Home, HowItWorks, NotFound, Pricing, Services } from "./pages/Marketing";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="areas" element={<Areas />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="faq" element={<Faq />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="book" element={<Book />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
