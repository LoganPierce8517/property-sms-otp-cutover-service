import express from "express";
import { propertyRoutes } from "./property_routes.js";

const app = express();
app.use(express.json());
app.use(propertyRoutes);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`property service listening on http://localhost:${port}`);
});
