/* Spa SAM website settings */
window.SAM_CONFIG = {
  // Google Apps Script "Web app" URL (ends with /exec). Leave "" for WhatsApp-only mode.
  apiUrl: "",

  social: {
    tiktok: "urutkt",                                         // TikTok handle: latest videos show automatically
    facebook: "https://www.facebook.com/share/1KP1inG5e8/",   // link for the Follow button
    facebookPage: ""                                          // Page address for the live Facebook feed, e.g. "https://www.facebook.com/SpaSamKT"
  },

  // Short looping video for the top of the page (muted, plays automatically), e.g. "img/sam-reel.mp4".
  // Leave "" to show Sam's photos as a moving slideshow instead.
  heroVideo: "",

  // REAL client reviews only, shared with the client's permission. Example format:
  // { name: "Ahmad", service: "Urutan Badan Penuh", rating: 5, date: "Nov 2026", text: "..." },
  testimonials: [
  ]
};
