// ─── Copy-Bindings (GENERIERT — nicht von Hand pflegen) ─────────────
// Quelle: tokenisierte Original-Schablone (147 Platzhalter-Positionen).
// Statt Tokens IN der Theme-Basis zu erwarten, schreibt die Compile-Engine
// diese tokenisierten Werte typ-basiert an die richtigen Stellen JEDER
// (auch rohen) Brospify-Basis: Position = (Template, Section-Typ,
// Block-Typ, Setting-Key, n-tes Vorkommen in order/block_order-Reihenfolge).
// Danach ersetzt die normale Token-Injection [[KEY]] durch die KI-Texte.
// Neu generieren: scratchpad/extract-bindings.js (siehe Session-Notizen).

export interface CopyBinding {
  tpl: "index" | "product";
  sectionType: string;
  blockType: string; // "" = Setting liegt direkt auf der Section
  key: string;
  occurrence: number; // 0-basiert, Zählung in order-/block_order-Reihenfolge
  value: string; // tokenisierter Wert, z. B. "<p>[[BRAND_DESCRIPTION]]</p>"
}

export const COPY_BINDINGS: CopyBinding[] = [
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "image_mobile",
    "occurrence": 0,
    "value": "[[IMAGE_URL_1]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "heading",
    "occurrence": 0,
    "value": "[[SLIDE_1_HEADING]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "subheading",
    "occurrence": 0,
    "value": "[[SLIDE_1_SUBHEADING]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box1_amount",
    "occurrence": 0,
    "value": "[[SLIDE_1_BOX1_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box1_price",
    "occurrence": 0,
    "value": "[[SLIDE_1_BOX1_PRICE]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box2_amount",
    "occurrence": 0,
    "value": "[[SLIDE_1_BOX2_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box2_price",
    "occurrence": 0,
    "value": "[[SLIDE_1_BOX2_PRICE]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box2_badge",
    "occurrence": 0,
    "value": "[[SLIDE_1_BOX2_BADGE]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "btn_text",
    "occurrence": 0,
    "value": "[[SLIDE_1_BTN_TEXT]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "heading",
    "occurrence": 1,
    "value": "[[SLIDE_2_HEADING]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "subheading",
    "occurrence": 1,
    "value": "[[SLIDE_2_SUBHEADING]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box1_amount",
    "occurrence": 1,
    "value": "[[SLIDE_2_BOX1_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box1_price",
    "occurrence": 1,
    "value": "[[SLIDE_2_BOX1_PRICE]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box2_amount",
    "occurrence": 1,
    "value": "[[SLIDE_2_BOX2_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box2_price",
    "occurrence": 1,
    "value": "[[SLIDE_2_BOX2_PRICE]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "box2_badge",
    "occurrence": 1,
    "value": "[[SLIDE_2_BOX2_BADGE]]"
  },
  {
    "tpl": "index",
    "sectionType": "slideshow2",
    "blockType": "slide",
    "key": "btn_text",
    "occurrence": 1,
    "value": "[[SLIDE_2_BTN_TEXT]]"
  },
  {
    "tpl": "index",
    "sectionType": "benefits",
    "blockType": "",
    "key": "title_1",
    "occurrence": 0,
    "value": "[[BENEFIT_1_TITLE]]"
  },
  {
    "tpl": "index",
    "sectionType": "benefits",
    "blockType": "",
    "key": "text_1",
    "occurrence": 0,
    "value": "[[BENEFIT_1_TEXT]]"
  },
  {
    "tpl": "index",
    "sectionType": "benefits",
    "blockType": "",
    "key": "title_2",
    "occurrence": 0,
    "value": "[[BENEFIT_2_TITLE]]"
  },
  {
    "tpl": "index",
    "sectionType": "benefits",
    "blockType": "",
    "key": "text_2",
    "occurrence": 0,
    "value": "[[BENEFIT_2_TEXT]]"
  },
  {
    "tpl": "index",
    "sectionType": "animatedtext",
    "blockType": "",
    "key": "subtitle",
    "occurrence": 0,
    "value": "[[EXPLAIN_SUBTITLE]]"
  },
  {
    "tpl": "index",
    "sectionType": "animatedtext",
    "blockType": "",
    "key": "title",
    "occurrence": 0,
    "value": "[[EXPLAIN_TITLE]]"
  },
  {
    "tpl": "index",
    "sectionType": "animatedtext",
    "blockType": "",
    "key": "text",
    "occurrence": 0,
    "value": "[[EXPLAIN_TEXT]]"
  },
  {
    "tpl": "index",
    "sectionType": "photo",
    "blockType": "",
    "key": "subtitle",
    "occurrence": 0,
    "value": "[[BRAND_SUBTITLE]]"
  },
  {
    "tpl": "index",
    "sectionType": "photo",
    "blockType": "",
    "key": "title",
    "occurrence": 0,
    "value": "[[BRAND_TITLE]]"
  },
  {
    "tpl": "index",
    "sectionType": "photo",
    "blockType": "",
    "key": "description",
    "occurrence": 0,
    "value": "[[BRAND_DESCRIPTION]]"
  },
  {
    "tpl": "index",
    "sectionType": "photo",
    "blockType": "",
    "key": "button_label",
    "occurrence": 0,
    "value": "[[BRAND_BUTTON_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "photo",
    "blockType": "",
    "key": "image_1",
    "occurrence": 0,
    "value": "[[IMAGE_URL_2]]"
  },
  {
    "tpl": "index",
    "sectionType": "photo",
    "blockType": "",
    "key": "image_2",
    "occurrence": 0,
    "value": "[[IMAGE_URL_3]]"
  },
  {
    "tpl": "index",
    "sectionType": "photo",
    "blockType": "",
    "key": "image_3",
    "occurrence": 0,
    "value": "[[IMAGE_URL_4]]"
  },
  {
    "tpl": "index",
    "sectionType": "content",
    "blockType": "",
    "key": "main_image",
    "occurrence": 0,
    "value": "[[IMAGE_URL_5]]"
  },
  {
    "tpl": "index",
    "sectionType": "content",
    "blockType": "",
    "key": "heading",
    "occurrence": 0,
    "value": "[[CONTENT_HEADING]]"
  },
  {
    "tpl": "index",
    "sectionType": "content",
    "blockType": "",
    "key": "text",
    "occurrence": 0,
    "value": "[[CONTENT_TEXT]]"
  },
  {
    "tpl": "index",
    "sectionType": "content",
    "blockType": "",
    "key": "button_text",
    "occurrence": 0,
    "value": "[[CONTENT_BUTTON_TEXT]]"
  },
  {
    "tpl": "index",
    "sectionType": "map",
    "blockType": "",
    "key": "address",
    "occurrence": 0,
    "value": "[[MAP_ADDRESS]]"
  },
  {
    "tpl": "index",
    "sectionType": "map",
    "blockType": "",
    "key": "subtitle",
    "occurrence": 0,
    "value": "[[MAP_SUBTITLE]]"
  },
  {
    "tpl": "index",
    "sectionType": "map",
    "blockType": "",
    "key": "title",
    "occurrence": 0,
    "value": "[[MAP_TITLE]]"
  },
  {
    "tpl": "index",
    "sectionType": "map",
    "blockType": "",
    "key": "text",
    "occurrence": 0,
    "value": "[[MAP_TEXT]]"
  },
  {
    "tpl": "index",
    "sectionType": "map",
    "blockType": "",
    "key": "btn_label",
    "occurrence": 0,
    "value": "[[MAP_BTN_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews",
    "blockType": "",
    "key": "heading_highlight",
    "occurrence": 0,
    "value": "[[REVIEWS_HIGHLIGHT]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews",
    "blockType": "",
    "key": "heading",
    "occurrence": 0,
    "value": "[[REVIEWS_HEADING]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews",
    "blockType": "",
    "key": "total_reviews_text",
    "occurrence": 0,
    "value": "[[REVIEWS_TOTAL_TEXT]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews",
    "blockType": "rating",
    "key": "label",
    "occurrence": 0,
    "value": "[[REVIEW_CAT_1_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews",
    "blockType": "rating",
    "key": "label",
    "occurrence": 1,
    "value": "[[REVIEW_CAT_2_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews",
    "blockType": "rating",
    "key": "label",
    "occurrence": 2,
    "value": "[[REVIEW_CAT_3_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews",
    "blockType": "rating",
    "key": "label",
    "occurrence": 3,
    "value": "[[REVIEW_CAT_4_LABEL]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "",
    "key": "eyebrow",
    "occurrence": 0,
    "value": "[[REVIEWS2_EYEBROW]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "",
    "key": "headline",
    "occurrence": 0,
    "value": "[[REVIEWS2_HEADLINE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "",
    "key": "headline_em",
    "occurrence": 0,
    "value": "[[REVIEWS2_HEADLINE_EM]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "",
    "key": "subline",
    "occurrence": 0,
    "value": "[[REVIEWS2_SUBLINE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 0,
    "value": "[[REVIEW2_1_QUOTE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 0,
    "value": "[[REVIEW2_1_AUTHOR]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 0,
    "value": "[[REVIEW2_1_LOCATION]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 0,
    "value": "[[REVIEW2_1_DATE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 1,
    "value": "[[REVIEW2_2_QUOTE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "image",
    "occurrence": 0,
    "value": "[[IMAGE_URL_6]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 1,
    "value": "[[REVIEW2_2_AUTHOR]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 1,
    "value": "[[REVIEW2_2_LOCATION]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 1,
    "value": "[[REVIEW2_2_DATE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 2,
    "value": "[[REVIEW2_3_QUOTE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 2,
    "value": "[[REVIEW2_3_AUTHOR]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 2,
    "value": "[[REVIEW2_3_LOCATION]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 2,
    "value": "[[REVIEW2_3_DATE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 3,
    "value": "[[REVIEW2_4_QUOTE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 3,
    "value": "[[REVIEW2_4_AUTHOR]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 3,
    "value": "[[REVIEW2_4_LOCATION]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 3,
    "value": "[[REVIEW2_4_DATE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 4,
    "value": "[[REVIEW2_5_QUOTE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 4,
    "value": "[[REVIEW2_5_AUTHOR]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 4,
    "value": "[[REVIEW2_5_LOCATION]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 4,
    "value": "[[REVIEW2_5_DATE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 5,
    "value": "[[REVIEW2_6_QUOTE]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 5,
    "value": "[[REVIEW2_6_AUTHOR]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 5,
    "value": "[[REVIEW2_6_LOCATION]]"
  },
  {
    "tpl": "index",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 5,
    "value": "[[REVIEW2_6_DATE]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "",
    "key": "pg_badge_text",
    "occurrence": 0,
    "value": "[[PRODUCT_BADGE_TEXT]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "custom_rating",
    "key": "rating_text",
    "occurrence": 0,
    "value": "[[PRODUCT_RATING_TEXT]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "benefits_list",
    "key": "text_1",
    "occurrence": 0,
    "value": "[[PRODUCT_USP_1]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "benefits_list",
    "key": "text_2",
    "occurrence": 0,
    "value": "[[PRODUCT_USP_2]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "benefits_list",
    "key": "text_3",
    "occurrence": 0,
    "value": "[[PRODUCT_USP_3]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "benefits_list",
    "key": "text_4",
    "occurrence": 0,
    "value": "[[PRODUCT_USP_4]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "stock_indicator",
    "key": "text",
    "occurrence": 0,
    "value": "[[PRODUCT_STOCK_TEXT]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "bundle_selector",
    "key": "heading",
    "occurrence": 0,
    "value": "[[BUNDLE_HEADING]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "bundle_selector",
    "key": "opt2_badge",
    "occurrence": 0,
    "value": "[[BUNDLE_OPT2_BADGE]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "free_gift",
    "key": "title",
    "occurrence": 0,
    "value": "[[GIFT_TITLE]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "free_gift",
    "key": "subtitle",
    "occurrence": 0,
    "value": "[[GIFT_SUBTITLE]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "custom_accordion",
    "key": "heading",
    "occurrence": 0,
    "value": "[[ACCORDION_1_HEADING]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "custom_accordion",
    "key": "content",
    "occurrence": 0,
    "value": "[[ACCORDION_1_CONTENT]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "custom_accordion",
    "key": "heading",
    "occurrence": 1,
    "value": "[[ACCORDION_2_HEADING]]"
  },
  {
    "tpl": "product",
    "sectionType": "main-product",
    "blockType": "custom_accordion",
    "key": "content",
    "occurrence": 1,
    "value": "[[ACCORDION_2_CONTENT]]"
  },
  {
    "tpl": "product",
    "sectionType": "bro-info-tabs",
    "blockType": "",
    "key": "heading",
    "occurrence": 0,
    "value": "[[INFO_TABS_HEADING]]"
  },
  {
    "tpl": "product",
    "sectionType": "bro-info-tabs",
    "blockType": "tab",
    "key": "body",
    "occurrence": 0,
    "value": "[[INFO_TAB_1_BODY]]"
  },
  {
    "tpl": "product",
    "sectionType": "bro-info-tabs",
    "blockType": "tab",
    "key": "body",
    "occurrence": 1,
    "value": "[[INFO_TAB_2_BODY]]"
  },
  {
    "tpl": "product",
    "sectionType": "bro-info-tabs",
    "blockType": "tab",
    "key": "body",
    "occurrence": 2,
    "value": "[[INFO_TAB_3_BODY]]"
  },
  {
    "tpl": "product",
    "sectionType": "bro-info-tabs",
    "blockType": "tab",
    "key": "body",
    "occurrence": 3,
    "value": "[[INFO_TAB_4_BODY]]"
  },
  {
    "tpl": "product",
    "sectionType": "scrollingbild",
    "blockType": "",
    "key": "image",
    "occurrence": 0,
    "value": "[[IMAGE_URL_7]]"
  },
  {
    "tpl": "product",
    "sectionType": "scrollingbild",
    "blockType": "",
    "key": "headline_line_1",
    "occurrence": 0,
    "value": "[[PARALLAX_HEADLINE]]"
  },
  {
    "tpl": "product",
    "sectionType": "scrollingbild",
    "blockType": "",
    "key": "lede",
    "occurrence": 0,
    "value": "[[PARALLAX_TEXT]]"
  },
  {
    "tpl": "product",
    "sectionType": "scrollingbild",
    "blockType": "",
    "key": "cta_primary_label",
    "occurrence": 0,
    "value": "[[PARALLAX_CTA_PRIMARY]]"
  },
  {
    "tpl": "product",
    "sectionType": "scrollingbild",
    "blockType": "",
    "key": "cta_secondary_label",
    "occurrence": 0,
    "value": "[[PARALLAX_CTA_SECONDARY]]"
  },
  {
    "tpl": "product",
    "sectionType": "socialicons",
    "blockType": "",
    "key": "heading",
    "occurrence": 0,
    "value": "[[SOCIAL_HEADING]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "",
    "key": "title",
    "occurrence": 0,
    "value": "[[VIDS_TITLE]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "",
    "key": "subtitle",
    "occurrence": 0,
    "value": "[[VIDS_SUBTITLE]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "name",
    "occurrence": 0,
    "value": "[[VIDS_T1_NAME]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "message",
    "occurrence": 0,
    "value": "[[VIDS_T1_MESSAGE]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "name",
    "occurrence": 1,
    "value": "[[VIDS_T2_NAME]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "message",
    "occurrence": 1,
    "value": "[[VIDS_T2_MESSAGE]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "name",
    "occurrence": 2,
    "value": "[[VIDS_T3_NAME]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "message",
    "occurrence": 2,
    "value": "[[VIDS_T3_MESSAGE]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "name",
    "occurrence": 3,
    "value": "[[VIDS_T4_NAME]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "message",
    "occurrence": 3,
    "value": "[[VIDS_T4_MESSAGE]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "name",
    "occurrence": 4,
    "value": "[[VIDS_T5_NAME]]"
  },
  {
    "tpl": "product",
    "sectionType": "vids",
    "blockType": "testimonial",
    "key": "message",
    "occurrence": 4,
    "value": "[[VIDS_T5_MESSAGE]]"
  },
  {
    "tpl": "product",
    "sectionType": "featured-collection",
    "blockType": "",
    "key": "title",
    "occurrence": 0,
    "value": "[[FEATURED_COLLECTION_TITLE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews",
    "blockType": "",
    "key": "heading_highlight",
    "occurrence": 0,
    "value": "[[P_REVIEWS_HIGHLIGHT]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews",
    "blockType": "",
    "key": "heading",
    "occurrence": 0,
    "value": "[[P_REVIEWS_HEADING]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews",
    "blockType": "",
    "key": "total_reviews_text",
    "occurrence": 0,
    "value": "[[P_REVIEWS_TOTAL_TEXT]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews",
    "blockType": "rating",
    "key": "label",
    "occurrence": 0,
    "value": "[[P_REVIEW_CAT_1_LABEL]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews",
    "blockType": "rating",
    "key": "label",
    "occurrence": 1,
    "value": "[[P_REVIEW_CAT_2_LABEL]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews",
    "blockType": "rating",
    "key": "label",
    "occurrence": 2,
    "value": "[[P_REVIEW_CAT_3_LABEL]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews",
    "blockType": "rating",
    "key": "label",
    "occurrence": 3,
    "value": "[[P_REVIEW_CAT_4_LABEL]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews",
    "blockType": "rating",
    "key": "label",
    "occurrence": 4,
    "value": "[[P_REVIEW_CAT_5_LABEL]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "",
    "key": "eyebrow",
    "occurrence": 0,
    "value": "[[P_REVIEWS2_EYEBROW]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "",
    "key": "headline",
    "occurrence": 0,
    "value": "[[P_REVIEWS2_HEADLINE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "",
    "key": "headline_em",
    "occurrence": 0,
    "value": "[[P_REVIEWS2_HEADLINE_EM]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "",
    "key": "subline",
    "occurrence": 0,
    "value": "[[P_REVIEWS2_SUBLINE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 0,
    "value": "[[P_REVIEW2_1_QUOTE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 0,
    "value": "[[P_REVIEW2_1_AUTHOR]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 0,
    "value": "[[P_REVIEW2_1_LOCATION]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 0,
    "value": "[[P_REVIEW2_1_DATE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 1,
    "value": "[[P_REVIEW2_2_QUOTE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 1,
    "value": "[[P_REVIEW2_2_AUTHOR]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 1,
    "value": "[[P_REVIEW2_2_LOCATION]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 1,
    "value": "[[P_REVIEW2_2_DATE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 2,
    "value": "[[P_REVIEW2_3_QUOTE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 2,
    "value": "[[P_REVIEW2_3_AUTHOR]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 2,
    "value": "[[P_REVIEW2_3_LOCATION]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 2,
    "value": "[[P_REVIEW2_3_DATE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 3,
    "value": "[[P_REVIEW2_4_QUOTE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 3,
    "value": "[[P_REVIEW2_4_AUTHOR]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 3,
    "value": "[[P_REVIEW2_4_LOCATION]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 3,
    "value": "[[P_REVIEW2_4_DATE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "quote",
    "occurrence": 4,
    "value": "[[P_REVIEW2_5_QUOTE]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "author_name",
    "occurrence": 4,
    "value": "[[P_REVIEW2_5_AUTHOR]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "location",
    "occurrence": 4,
    "value": "[[P_REVIEW2_5_LOCATION]]"
  },
  {
    "tpl": "product",
    "sectionType": "reviews2",
    "blockType": "review",
    "key": "date",
    "occurrence": 4,
    "value": "[[P_REVIEW2_5_DATE]]"
  }
] as CopyBinding[];
