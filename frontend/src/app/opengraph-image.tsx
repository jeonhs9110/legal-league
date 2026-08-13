import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";
import { getCoverage, getNewsSnapshotMeta } from "@/lib/data";

/**
 * The card every LinkedIn, Slack and X share renders. Without it those shares
 * show a blank rectangle, which for a publication reads as abandoned.
 *
 * Generated from the live figures rather than drawn once, so the card cannot
 * drift away from what the site actually holds — and it is typographic, so
 * there is no generated-image watermark to crop out.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE.name} — ${SITE.slogan}`;

export default async function OpengraphImage() {
  const [coverage, news] = await Promise.all([
    getCoverage(),
    getNewsSnapshotMeta(),
  ]);

  const stats = [
    [String(coverage.jurisdictions), "Jurisdictions"],
    [String(coverage.firms), "Firms listed"],
    [String(news.total), "Articles tracked"],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FBFAF7",
          padding: "68px 76px",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div
            style={{
              fontSize: 19,
              letterSpacing: "0.22em",
              color: "#7A2230",
              textTransform: "uppercase",
            }}
          >
            leagueoflegals.com
          </div>
          <div style={{ fontSize: 19, letterSpacing: "0.14em", color: "#6B7280" }}>
            OPEN METHODOLOGY
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 124,
              lineHeight: 1,
              color: "#14161A",
              letterSpacing: "-0.03em",
            }}
          >
            Legal League
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 36,
              fontStyle: "italic",
              color: "#4B5563",
            }}
          >
            {SITE.slogan}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 64,
            borderTop: "2px solid #14161A",
            paddingTop: 26,
          }}
        >
          {stats.map(([value, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 46, color: "#14161A", letterSpacing: "-0.02em" }}>
                {value}
              </div>
              <div
                style={{
                  fontSize: 17,
                  letterSpacing: "0.16em",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  marginTop: 6,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
