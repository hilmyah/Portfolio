import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"

// bait: pesan untuk yang membuka console browser sambil mencari celah.
console.log(
  "%cNice try.%c\nLooking for a way in? There is nothing hidden here, the source is public:\nhttps://github.com/hilmyah/Portfolio",
  "font: 700 20px ui-monospace, monospace; color: #f5c542",
  "font: 13px ui-monospace, monospace",
)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
