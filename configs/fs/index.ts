import { v2 } from "cloudinary";

v2.config({
  secure: true,
});

const storage = v2;

export default storage;
