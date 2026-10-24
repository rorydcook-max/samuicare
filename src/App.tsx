import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Book from "./pages/Book";
import BookDone from "./pages/BookDone";
import { Businesses, Contact, Faq, Home, NotFound, Prices, Redirect } from "./pages/Marketing";

const AdminApp = lazy(() => import("./admin/AdminApp"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="prices" element={<Prices />} />
          <Route path="businesses" element={<Businesses />} />
          <Route path="faq" element={<Faq />} />
          <Route path="contact" element={<Contact />} />
          <Route path="book" element={<Book />} />
          <Route path="book/done" element={<BookDone />} />
          {/* Old addresses from the first version of the site */}
          <Route path="pricing" element={<Redirect to="/prices" />} />
          <Route path="services" element={<Redirect to="/businesses" />} />
          {["areas", "how-it-works", "about"].map((p) => <Route key={p} path={p} element={<Redirect to="/" />} />)}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
