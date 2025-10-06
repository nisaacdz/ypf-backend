import * as enums from "./enums";
import * as app from "./app";
import * as core from "./core";
import * as activities from "./activities";
import * as finance from "./finance";
import * as communications from "./communications";
import * as shop from "./shop";

const schema = {
  ...enums,
  ...app,
  ...core,
  ...activities,
  ...finance,
  ...communications,
  ...shop,
};

export default schema;
