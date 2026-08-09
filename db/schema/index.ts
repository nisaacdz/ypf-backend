import * as app from "./app";
import * as core from "./core";
import * as activities from "./activities";
import * as content from "./content";
import * as finance from "./finance";
import * as shop from "./shop";
import * as logs from "./logs";

const schema = {
  ...app,
  ...core,
  ...activities,
  ...content,
  ...finance,
  ...shop,
  ...logs,
};

export default schema;
