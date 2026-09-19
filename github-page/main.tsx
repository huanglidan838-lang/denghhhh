import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PortfolioExperience from "../app/PortfolioExperience";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PortfolioExperience />
  </StrictMode>,
);
