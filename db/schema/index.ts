import * as app from "./app";
import * as core from "./core";
import * as activities from "./activities";
import * as finance from "./finance";
import * as shop from "./shop";

const schema = {
  ...app,
  ...core,
  ...activities,
  ...finance,
  ...shop,
};

export default schema;
