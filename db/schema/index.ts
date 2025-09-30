import * as enums from "./enums";
import * as app from "./app";
import * as core from "./core";
import * as activities from "./activities";
import * as finance from "./finance";
import * as communications from "./communications";

const schema = {
  ...enums,
  ...app,
  ...core,
  ...activities,
  ...finance,
  ...communications,
};

export default schema;
