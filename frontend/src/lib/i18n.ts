/**
 * Interface language.
 *
 * The project standard is that everything is collected, clustered and written
 * in English; translation happens at the surface. That decision is what keeps
 * one corpus and one methodology instead of four diverging ones.
 *
 * So this translates the chrome — navigation, section headings, the standing
 * disclosures — and leaves headlines and briefs in the language their
 * publisher wrote them in. A Korean reader gets a Korean interface around
 * English reporting, which is what every serious multilingual trade
 * publication does, and it is honest: we have not translated the reporting,
 * so we do not pretend to have.
 */

export const LOCALES = ["en", "ko", "ja", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
};

/** Short label for the floating switcher, where space is tight. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  ko: "KO",
  ja: "JA",
  zh: "ZH",
};

export type Dictionary = {
  nav: {
    rankings: string;
    news: string;
    methodology: string;
    forFirms: string;
  };
  home: {
    directory: string;
    directoryBlurb: string;
    news: string;
    newsBlurb: string;
    coverage: string;
    allJurisdictions: string;
    allCoverage: string;
  };
  common: {
    firms: string;
    stories: string;
    noRanking: string;
    verified: string;
    publishers: string;
    language: string;
    sourceNote: string;
  };
};

const en: Dictionary = {
  nav: {
    rankings: "Rankings",
    news: "News",
    methodology: "Methodology",
    forFirms: "For firms",
  },
  home: {
    directory: "The directory",
    directoryBlurb:
      "Law firms by jurisdiction, grouped by continent. Every listing records the source it came from.",
    news: "The news",
    newsBlurb:
      "Legal industry reporting, grouped by the same continents, linked back to whoever wrote it.",
    coverage: "Where we have coverage",
    allJurisdictions: "All 35 jurisdictions",
    allCoverage: "All coverage",
  },
  common: {
    firms: "firms",
    stories: "stories",
    noRanking: "No ranking published",
    verified: "Verified",
    publishers: "publishers",
    language: "Language",
    sourceNote:
      "Reporting is shown in the language its publisher wrote it in. The interface is translated; the journalism is not.",
  },
};

const ko: Dictionary = {
  nav: {
    rankings: "로펌 순위",
    news: "뉴스",
    methodology: "평가 방법론",
    forFirms: "로펌 안내",
  },
  home: {
    directory: "로펌 디렉터리",
    directoryBlurb:
      "대륙별로 정리한 관할별 로펌 목록입니다. 모든 항목은 출처를 함께 기록합니다.",
    news: "법조 뉴스",
    newsBlurb:
      "같은 대륙 구분으로 정리한 법조계 보도이며, 원 보도 매체로 연결됩니다.",
    coverage: "수록 관할",
    allJurisdictions: "전체 35개 관할",
    allCoverage: "전체 보도",
  },
  common: {
    firms: "개 로펌",
    stories: "건",
    noRanking: "순위 미공개",
    verified: "확인됨",
    publishers: "개 매체",
    language: "언어",
    sourceNote:
      "보도는 원 매체가 작성한 언어 그대로 표시됩니다. 인터페이스만 번역되며 기사 본문은 번역하지 않습니다.",
  },
};

const ja: Dictionary = {
  nav: {
    rankings: "法律事務所ランキング",
    news: "ニュース",
    methodology: "評価方法",
    forFirms: "事務所の方へ",
  },
  home: {
    directory: "事務所ディレクトリ",
    directoryBlurb:
      "大陸ごとに整理した法域別の法律事務所一覧です。すべての項目に出典を記録しています。",
    news: "法曹ニュース",
    newsBlurb:
      "同じ大陸区分で整理した法曹界の報道で、執筆した媒体へリンクしています。",
    coverage: "収録法域",
    allJurisdictions: "全35法域",
    allCoverage: "すべての報道",
  },
  common: {
    firms: "事務所",
    stories: "件",
    noRanking: "ランキング未公開",
    verified: "確認済み",
    publishers: "媒体",
    language: "言語",
    sourceNote:
      "報道は執筆した媒体の言語のまま表示されます。翻訳するのはインターフェースのみで、記事本文は翻訳していません。",
  },
};

const zh: Dictionary = {
  nav: {
    rankings: "律所排名",
    news: "新闻",
    methodology: "评估方法",
    forFirms: "律所专区",
  },
  home: {
    directory: "律所名录",
    directoryBlurb:
      "按大洲划分的各法域律所名录。每条记录均标注其来源。",
    news: "法律新闻",
    newsBlurb:
      "按相同大洲划分的法律行业报道，并链接至原报道媒体。",
    coverage: "覆盖法域",
    allJurisdictions: "全部 35 个法域",
    allCoverage: "全部报道",
  },
  common: {
    firms: "家律所",
    stories: "篇",
    noRanking: "尚未发布排名",
    verified: "已核实",
    publishers: "家媒体",
    language: "语言",
    sourceNote:
      "报道以原媒体撰写的语言呈现。我们翻译界面，但不翻译报道本身。",
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, ko, ja, zh };

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
