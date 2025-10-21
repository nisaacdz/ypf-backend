import ImageKit from "imagekit";
import variables from "../env";

export const imagekit = new ImageKit({
  publicKey: variables.services.imagekit.publicKey,
  privateKey: variables.services.imagekit.privateKey,
  urlEndpoint: variables.services.imagekit.urlEndpoint,
});
