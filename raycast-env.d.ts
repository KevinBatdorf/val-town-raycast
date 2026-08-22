/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Val Town API Token - Create one at val.town/settings/api */
  "apiToken": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-vals` command */
  export type SearchVals = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-vals` command */
  export type SearchVals = {}
}

