export default function decorate(block) {
  block.innerHTML = `
    <div class="aibootcamp-hero-inner">
      <div class="aibootcamp-hero-brand">
        <img src="/icons/adobe-wordmark.svg" alt="Adobe" class="aibootcamp-hero-logo" width="72" height="18"/>
        <span class="aibootcamp-hero-divider"></span>
        <span class="aibootcamp-hero-event">AI Bootcamp NL 2026</span>
      </div>
      <h1 class="aibootcamp-hero-title">Your Brand Visibility Report</h1>
      <p class="aibootcamp-hero-desc">Powered by Adobe AI, this report analyses your brand's digital presence — how visible you are across search engines, AI platforms, and the open web. Use these insights to understand where you stand today and the opportunities ahead.</p>
    </div>
  `;
}
