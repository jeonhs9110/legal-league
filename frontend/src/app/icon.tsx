import { ImageResponse } from "next/og";

/**
 * Favicon, generated rather than drawn.
 *
 * A typographic mark survives being 16px wide, which is the only size that
 * actually matters in a browser tab, and it carries no generated-image
 * watermark to crop. The oxblood ground is the same accent used for rank
 * figures and link underlines, so the tab reads as part of the publication.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7A2230",
          color: "#FBFAF7",
          fontSize: 21,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 400,
          letterSpacing: "-0.04em",
        }}
      >
        LL
      </div>
    ),
    size,
  );
}
