/**
 * nash-about block — self-contained, no authored content needed.
 * @param {Element} block
 */
export default async function decorate(block) {
  block.innerHTML = `
    <div class="nash-about-hero">
      <div class="nash-about-hero-inner">
        <p class="nash-about-eyebrow">Named after a legend</p>
        <h1 class="nash-about-hero-name">John Forbes<br>Nash Jr.</h1>
        <p class="nash-about-hero-dates">1928 &ndash; 2015</p>
        <p class="nash-about-hero-sub">
          Mathematician. Game theorist. Nobel laureate. Abel Prize winner.<br>
          The man who figured out how rational agents make optimal moves<br>in competitive situations &mdash; which is exactly what this tool does.
        </p>
      </div>
      <div class="nash-about-hero-stat-row">
        <div class="nash-about-hero-stat">
          <span class="nash-about-hero-stat-num">27</span>
          <span class="nash-about-hero-stat-label">pages in his PhD<br>dissertation, 1950</span>
        </div>
        <div class="nash-about-hero-stat">
          <span class="nash-about-hero-stat-num">21</span>
          <span class="nash-about-hero-stat-label">years old when<br>he wrote it</span>
        </div>
        <div class="nash-about-hero-stat">
          <span class="nash-about-hero-stat-num">44</span>
          <span class="nash-about-hero-stat-label">years later,<br>he won the Nobel</span>
        </div>
        <div class="nash-about-hero-stat">
          <span class="nash-about-hero-stat-num">4</span>
          <span class="nash-about-hero-stat-label">days after the Abel Prize,<br>he was gone</span>
        </div>
      </div>
    </div>

    <div class="nash-about-body">

      <section class="nash-about-section nash-about-tool">
        <div class="nash-about-section-label">The Tool</div>
        <div class="nash-about-section-content">
          <p class="nash-about-lead">
            Nash helps Adobe sales teams qualify AEM opportunities faster &mdash; scoring fit,
            surfacing competitive risks, and turning a stack of RFI documents into a
            structured recommendation in minutes.
          </p>
          <div class="nash-about-builders">
            <div class="nash-about-builder">
              <div class="nash-about-builder-av" style="background:#eb1000">M</div>
              <div>
                <div class="nash-about-builder-name">Max</div>
                <div class="nash-about-builder-role">Co-creator</div>
              </div>
            </div>
            <div class="nash-about-builder">
              <div class="nash-about-builder-av" style="background:#111318">V</div>
              <div>
                <div class="nash-about-builder-name">Vitor</div>
                <div class="nash-about-builder-role">Co-creator</div>
              </div>
            </div>
          </div>
          <p class="nash-about-origin">
            Built because three hours per deal doing work a well-prompted AI
            could do in three minutes felt like a bad use of everyone&rsquo;s time.
          </p>
        </div>
      </section>

      <section class="nash-about-section">
        <div class="nash-about-section-label">The Name</div>
        <div class="nash-about-section-content">
          <blockquote class="nash-about-quote">
            &ldquo;Given what everyone else is doing &mdash; what&rsquo;s the best move?&rdquo;
            <cite>Nash Equilibrium, simplified</cite>
          </blockquote>
          <p>
            Every AEM deal is a game. Competitors are making their moves.
            The customer is weighing their options. Nash scores each opportunity
            the same way its namesake approached every problem &mdash; systematically,
            rationally, and with the competitive landscape fully in view.
          </p>
        </div>
      </section>

      <section class="nash-about-section">
        <div class="nash-about-section-label">The Man</div>
        <div class="nash-about-section-content nash-about-facts">

          <div class="nash-about-fact">
            <div class="nash-about-fact-num">01</div>
            <div>
              <h3>The 27-page dissertation that changed economics</h3>
              <p>Written at Princeton in 1950 at age 21. It introduced the Nash Equilibrium
              and eventually earned him a Nobel Prize. If Nash the tool could be that concise
              and that consequential, we&rsquo;d be happy.</p>
            </div>
          </div>

          <div class="nash-about-fact">
            <div class="nash-about-fact-num">02</div>
            <div>
              <h3>He won a Nobel Prize in Economics &mdash; not Mathematics</h3>
              <p>There is no Nobel Prize in Mathematics, a fact that has irritated mathematicians
              for over a century. Nash&rsquo;s work was so foundational to economics that the
              Economics committee claimed him. Mathematicians have been quietly furious ever since.</p>
            </div>
          </div>

          <div class="nash-about-fact">
            <div class="nash-about-fact-num">03</div>
            <div>
              <h3>He also won the Abel Prize &mdash; the highest honour in mathematics</h3>
              <p>In 2015, 65 years after his dissertation, the maths world finally got to claim him back.
              He received it in Oslo on May 19th. He died four days later in a taxi on the
              New Jersey Turnpike. The universe has a dark sense of timing.</p>
            </div>
          </div>

          <div class="nash-about-fact">
            <div class="nash-about-fact-num">04</div>
            <div>
              <h3>Russell Crowe played him in <em>A Beautiful Mind</em></h3>
              <p>The film won Best Picture in 2002. Nash attended the Oscars. He is reported
              to have been more interested in the mathematics of voting systems used to
              select the winner than in the fact that a film had been made about his life.</p>
            </div>
          </div>

          <div class="nash-about-fact">
            <div class="nash-about-fact-num">05</div>
            <div>
              <h3>The Nash Equilibrium explains things you wish it didn&rsquo;t</h3>
              <p>Arms races. Price wars. Why every airline charges for checked bags even though
              everyone hates it. Once you understand it, you start seeing it everywhere
              &mdash; and you can&rsquo;t stop.</p>
            </div>
          </div>

        </div>
      </section>

      <section class="nash-about-section">
        <div class="nash-about-section-label">How It Works</div>
        <div class="nash-about-section-content">
          <div class="nash-about-steps">
            <div class="nash-about-step">
              <div class="nash-about-step-num">1</div>
              <div>
                <h3>Ingest</h3>
                <p>Upload RFI, RFP, and supporting documents. Nash parses and extracts the signals.</p>
              </div>
            </div>
            <div class="nash-about-step">
              <div class="nash-about-step-num">2</div>
              <div>
                <h3>Score</h3>
                <p>Six dimensions scored against your Solutions Files: Strategic Fit, Technical Fit,
                Functional Coverage, Commercial Viability, Competitive Position, Delivery Risk.</p>
              </div>
            </div>
            <div class="nash-about-step">
              <div class="nash-about-step-num">3</div>
              <div>
                <h3>Report</h3>
                <p>A structured qualification report with fit score, verdict, red flags, and
                recommended AEM products &mdash; ready for your customer meeting.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="nash-about-stack">
        <span class="nash-about-stack-label">Built with</span>
        <div class="nash-about-stack-chips">
          <span class="nash-about-chip">AEM Edge Delivery Services</span>
          <span class="nash-about-chip">Document Authoring</span>
          <span class="nash-about-chip">Claude &middot; Anthropic</span>
          <span class="nash-about-chip">Adobe Analytics</span>
          <span class="nash-about-chip">A lot of coffee</span>
        </div>
      </div>

    </div>
  `;

  document.dispatchEvent(new CustomEvent('nash:page-title', { detail: { title: 'About Nash' }, bubbles: true }));
}
