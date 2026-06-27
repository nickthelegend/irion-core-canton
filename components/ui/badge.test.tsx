import { test } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Badge, badgeVariants } from "./badge.tsx"

// Real component rendering (react-dom/server executes the component).

test("Badge renders a span with its children", () => {
  const html = renderToStaticMarkup(<Badge>Live</Badge>)
  assert.match(html, /Live/)
  assert.match(html, /data-slot="badge"/)
})

test("Badge applies variant classes", () => {
  assert.match(renderToStaticMarkup(<Badge variant="secondary">X</Badge>), /bg-secondary/)
})

test("Badge merges a custom className", () => {
  assert.match(renderToStaticMarkup(<Badge className="custom-x">Y</Badge>), /custom-x/)
})

test("badgeVariants returns the variant class string", () => {
  assert.match(badgeVariants({ variant: "destructive" }), /bg-destructive/)
  assert.match(badgeVariants({ variant: "outline" }), /text-foreground/)
})
