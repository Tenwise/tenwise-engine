import { readStoredNumber, writeStored } from './storage.js';

/**
 * Curated popular feeds organized by category for the Add Feed modal.
 */
export const POPULAR_FEEDS = [
  {
    category: 'Technology',
    emoji: '💻',
    description: 'Gadgets, software, and digital innovation',
    feeds: [
      { title: 'TechCrunch', url: 'https://techcrunch.com/feed/', siteUrl: 'https://techcrunch.com', description: 'Startup and tech news' },
      { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', siteUrl: 'https://www.theverge.com', description: 'Technology, science, art, and culture' },
      { title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', siteUrl: 'https://arstechnica.com', description: 'In-depth tech analysis and reviews' },
      { title: 'Hacker News', url: 'https://news.ycombinator.com/rss', siteUrl: 'https://news.ycombinator.com', description: 'Top stories from the tech community' },
      { title: 'Wired', url: 'https://www.wired.com/feed/rss', siteUrl: 'https://www.wired.com', description: 'Future of technology and culture' },
      { title: 'The Next Web', url: 'https://thenextweb.com/feed', siteUrl: 'https://thenextweb.com', description: 'Tech news and analysis' },
      { title: 'MIT Technology Review', url: 'https://www.technologyreview.com/topnews.rss', siteUrl: 'https://www.technologyreview.com', description: 'Technology\'s impact on society' },
      { title: 'Engadget', url: 'https://www.engadget.com/rss.xml', siteUrl: 'https://www.engadget.com', description: 'Consumer electronics and gadgets' },
      { title: 'Gizmodo', url: 'https://gizmodo.com/rss', siteUrl: 'https://gizmodo.com', description: 'Technology, science, and gadgets' },
    ],
  },
  {
    category: 'AI & Machine Learning',
    emoji: '🤖',
    description: 'Artificial intelligence breakthroughs and research',
    feeds: [
      { title: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', siteUrl: 'https://openai.com', description: 'Research and announcements from OpenAI' },
      { title: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', siteUrl: 'https://blog.google', description: 'AI research from Google' },
      { title: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', siteUrl: 'https://huggingface.co', description: 'Open-source AI models and tools' },
      { title: 'DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml', siteUrl: 'https://deepmind.google', description: 'AI safety and research from DeepMind' },
      { title: 'MIT News – AI', url: 'https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml', siteUrl: 'https://news.mit.edu', description: 'AI research from MIT' },
      { title: 'The Gradient', url: 'https://thegradient.pub/rss/', siteUrl: 'https://thegradient.pub', description: 'Accessible ML research explanations' },
      { title: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/', siteUrl: 'https://www.artificialintelligence-news.com', description: 'Latest AI industry news' },
      { title: 'Synced Review', url: 'https://syncedreview.com/feed/', siteUrl: 'https://syncedreview.com', description: 'Global AI technology coverage' },
      { title: 'Towards AI', url: 'https://pub.towardsai.net/feed', siteUrl: 'https://towardsai.net', description: 'AI research and tutorials' },
    ],
  },
  {
    category: 'Developer & Engineering',
    emoji: '⚙️',
    description: 'Software development, architecture, and engineering',
    feeds: [
      { title: 'GitHub Blog', url: 'https://github.blog/feed/', siteUrl: 'https://github.blog', description: 'GitHub product and engineering updates' },
      { title: 'Stack Overflow Blog', url: 'https://stackoverflow.blog/feed/', siteUrl: 'https://stackoverflow.blog', description: 'Developer insights and community' },
      { title: 'Dev.to', url: 'https://dev.to/feed', siteUrl: 'https://dev.to', description: 'Developer community articles and tutorials' },
      { title: 'Lobsters', url: 'https://lobste.rs/rss', siteUrl: 'https://lobste.rs', description: 'Curated computing community links' },
      { title: 'InfoQ', url: 'https://feed.infoq.com/', siteUrl: 'https://www.infoq.com', description: 'Software development news and patterns' },
      { title: 'Martin Fowler', url: 'https://martinfowler.com/feed.atom', siteUrl: 'https://martinfowler.com', description: 'Software design and architecture essays' },
      { title: 'Joel on Software', url: 'https://www.joelonsoftware.com/feed/', siteUrl: 'https://www.joelonsoftware.com', description: 'Software management and development' },
      { title: 'CSS-Tricks', url: 'https://css-tricks.com/feed/', siteUrl: 'https://css-tricks.com', description: 'Web development tips and techniques' },
      { title: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/', siteUrl: 'https://www.smashingmagazine.com', description: 'Web design and front-end development' },
    ],
  },
  {
    category: 'Cybersecurity',
    emoji: '🔐',
    description: 'Security research, threats, and best practices',
    feeds: [
      { title: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', siteUrl: 'https://krebsonsecurity.com', description: 'In-depth security news and investigation' },
      { title: 'Schneier on Security', url: 'https://www.schneier.com/feed/atom/', siteUrl: 'https://www.schneier.com', description: 'Security expert commentary and analysis' },
      { title: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml', siteUrl: 'https://www.darkreading.com', description: 'Enterprise cybersecurity news' },
      { title: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', siteUrl: 'https://thehackernews.com', description: 'Cybersecurity news and analysis' },
      { title: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/', siteUrl: 'https://www.bleepingcomputer.com', description: 'Security news and tech support' },
      { title: 'SANS Internet Storm Center', url: 'https://isc.sans.edu/rssfeed_full.xml', siteUrl: 'https://isc.sans.edu', description: 'Daily security diary and threat alerts' },
      { title: 'Threatpost', url: 'https://threatpost.com/feed/', siteUrl: 'https://threatpost.com', description: 'Security vulnerabilities and threats' },
      { title: 'Troy Hunt Blog', url: 'https://www.troyhunt.com/rss/', siteUrl: 'https://www.troyhunt.com', description: 'Web security research and breaches' },
    ],
  },
  {
    category: 'Data Science',
    emoji: '📊',
    description: 'Data analytics, visualization, and machine learning',
    feeds: [
      { title: 'Towards Data Science', url: 'https://towardsdatascience.com/feed', siteUrl: 'https://towardsdatascience.com', description: 'Data science tutorials and insights' },
      { title: 'KDNuggets', url: 'https://www.kdnuggets.com/feed', siteUrl: 'https://www.kdnuggets.com', description: 'Data science, ML, and AI news' },
      { title: "O'Reilly Radar", url: 'https://www.oreilly.com/radar/feed/index.xml', siteUrl: 'https://www.oreilly.com/radar', description: 'Technology and data insights' },
      { title: 'Analytics Vidhya', url: 'https://www.analyticsvidhya.com/feed/', siteUrl: 'https://www.analyticsvidhya.com', description: 'Data science tutorials and competitions' },
      { title: 'Simply Statistics', url: 'https://simplystatistics.org/index.xml', siteUrl: 'https://simplystatistics.org', description: 'Statistics blog for data scientists' },
      { title: 'Flowing Data', url: 'https://flowingdata.com/feed', siteUrl: 'https://flowingdata.com', description: 'Data visualization and statistics' },
    ],
  },
  {
    category: 'Science',
    emoji: '🔬',
    description: 'Scientific research, discoveries, and breakthroughs',
    feeds: [
      { title: 'Nature', url: 'https://www.nature.com/nature.rss', siteUrl: 'https://www.nature.com', description: 'Leading international scientific journal' },
      { title: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', siteUrl: 'https://www.sciencedaily.com', description: 'Breaking science news every day' },
      { title: 'Phys.org', url: 'https://phys.org/rss-feed/', siteUrl: 'https://phys.org', description: 'Physics, materials science, and more' },
      { title: 'Scientific American', url: 'https://rss.sciam.com/ScientificAmerican-Global', siteUrl: 'https://www.scientificamerican.com', description: 'Science for curious minds' },
      { title: 'New Scientist', url: 'https://www.newscientist.com/feed/home/', siteUrl: 'https://www.newscientist.com', description: 'Science and technology weekly' },
      { title: 'Live Science', url: 'https://www.livescience.com/feeds/all', siteUrl: 'https://www.livescience.com', description: 'Science news and amazing discoveries' },
      { title: 'Quanta Magazine', url: 'https://www.quantamagazine.org/feed/', siteUrl: 'https://www.quantamagazine.org', description: 'Illuminating math and physics research' },
    ],
  },
  {
    category: 'Space & Astronomy',
    emoji: '🌌',
    description: 'Space exploration, astronomy, and the cosmos',
    feeds: [
      { title: 'NASA Breaking News', url: 'https://www.nasa.gov/news-release/feed/', siteUrl: 'https://www.nasa.gov', description: 'Official news from NASA' },
      { title: 'Space.com', url: 'https://www.space.com/feeds/all', siteUrl: 'https://www.space.com', description: 'Space exploration and astronomy news' },
      { title: 'Astronomy Picture of the Day', url: 'https://apod.nasa.gov/apod.rss', siteUrl: 'https://apod.nasa.gov', description: 'Daily cosmic wonders from NASA' },
      { title: 'Sky & Telescope', url: 'https://skyandtelescope.org/feed/', siteUrl: 'https://skyandtelescope.org', description: 'Astronomy news and observing guides' },
      { title: 'Universe Today', url: 'https://www.universetoday.com/feed/', siteUrl: 'https://www.universetoday.com', description: 'Space and astronomy news' },
      { title: 'The Planetary Society', url: 'https://www.planetary.org/rss/news', siteUrl: 'https://www.planetary.org', description: 'Space advocacy and exploration news' },
      { title: 'ESA News', url: 'https://www.esa.int/rssfeed/Our_Activities/Space_Science', siteUrl: 'https://www.esa.int', description: 'European Space Agency science news' },
    ],
  },
  {
    category: 'Health & Medicine',
    emoji: '🏥',
    description: 'Medical research, wellness, and healthcare news',
    feeds: [
      { title: 'Harvard Health Blog', url: 'https://www.health.harvard.edu/blog/feed', siteUrl: 'https://www.health.harvard.edu', description: 'Expert health advice from Harvard' },
      { title: 'STAT News', url: 'https://www.statnews.com/feed/', siteUrl: 'https://www.statnews.com', description: 'Health, medicine, and biotech' },
      { title: 'WebMD Health News', url: 'https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC', siteUrl: 'https://www.webmd.com', description: 'Health news and information' },
      { title: 'The Lancet', url: 'https://www.thelancet.com/rssfeed/lancet_current.xml', siteUrl: 'https://www.thelancet.com', description: 'Leading medical journal' },
      { title: 'NIH News', url: 'https://www.nih.gov/news-events/feed', siteUrl: 'https://www.nih.gov', description: 'National Institutes of Health updates' },
      { title: 'Health Affairs', url: 'https://www.healthaffairs.org/rss/site_3/', siteUrl: 'https://www.healthaffairs.org', description: 'Health policy and research' },
      { title: 'Medscape Medical News', url: 'https://www.medscape.com/cx/rssfeeds/2047-2067-2049.xml', siteUrl: 'https://www.medscape.com', description: 'Clinical news for physicians' },
    ],
  },
  {
    category: 'Business & Finance',
    emoji: '💼',
    description: 'Business strategy, leadership, and financial markets',
    feeds: [
      { title: 'Harvard Business Review', url: 'https://hbr.org/rss/most-popular', siteUrl: 'https://hbr.org', description: 'Management and leadership ideas' },
      { title: 'Inc. Magazine', url: 'https://www.inc.com/rss', siteUrl: 'https://www.inc.com', description: 'Growing companies and entrepreneurs' },
      { title: 'Entrepreneur', url: 'https://www.entrepreneur.com/latest.rss', siteUrl: 'https://www.entrepreneur.com', description: 'Business startup and growth' },
      { title: 'Fast Company', url: 'https://www.fastcompany.com/latest/rss', siteUrl: 'https://www.fastcompany.com', description: 'Innovation in business and design' },
      { title: 'Forbes', url: 'https://www.forbes.com/innovation/feed2', siteUrl: 'https://www.forbes.com', description: 'Business news and analysis' },
      { title: 'First Round Review', url: 'https://review.firstround.com/feed.xml', siteUrl: 'https://review.firstround.com', description: 'Deep dives for startup founders' },
      { title: 'Morning Brew', url: 'https://www.morningbrew.com/daily/rss', siteUrl: 'https://www.morningbrew.com', description: 'Business news in a fun way' },
    ],
  },
  {
    category: 'Startups & Venture Capital',
    emoji: '🚀',
    description: 'Startup ecosystem, funding, and founder stories',
    feeds: [
      { title: 'Y Combinator Blog', url: 'https://www.ycombinator.com/blog/rss/', siteUrl: 'https://www.ycombinator.com', description: 'Insights from the top startup accelerator' },
      { title: 'a16z Blog', url: 'https://a16z.com/feed/', siteUrl: 'https://a16z.com', description: 'Technology and culture from Andreessen Horowitz' },
      { title: 'Paul Graham Essays', url: 'http://www.aaronsw.com/2002/feeds/pgessays.rss', siteUrl: 'http://paulgraham.com', description: 'Essays by PG on startups and life' },
      { title: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/', siteUrl: 'https://news.crunchbase.com', description: 'Startup funding and M&A news' },
      { title: 'StrictlyVC', url: 'https://strictlyvc.com/feed/', siteUrl: 'https://strictlyvc.com', description: 'Venture capital newsletter' },
      { title: 'Both Sides of the Table', url: 'https://bothsidesofthetable.com/feed', siteUrl: 'https://bothsidesofthetable.com', description: 'VC perspective by Mark Suster' },
      { title: 'Stratechery', url: 'https://stratechery.com/feed/', siteUrl: 'https://stratechery.com', description: 'Tech strategy and business analysis' },
    ],
  },
  {
    category: 'World News',
    emoji: '📰',
    description: 'Global news, politics, and current affairs',
    feeds: [
      { title: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml', siteUrl: 'https://www.bbc.com/news', description: 'Global news from the BBC' },
      { title: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', siteUrl: 'https://www.npr.org', description: 'National public radio top stories' },
      { title: 'The Guardian', url: 'https://www.theguardian.com/world/rss', siteUrl: 'https://www.theguardian.com', description: 'International news and analysis' },
      { title: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', siteUrl: 'https://www.aljazeera.com', description: 'Global news with non-Western perspective' },
      { title: 'Reuters', url: 'https://www.reutersagency.com/feed/', siteUrl: 'https://www.reuters.com', description: 'Trusted global news wire service' },
      { title: 'Associated Press', url: 'https://rsshub.app/apnews/topics/apf-topnews', siteUrl: 'https://apnews.com', description: 'Breaking news from the AP wire' },
      { title: 'The Economist', url: 'https://www.economist.com/the-world-this-week/rss.xml', siteUrl: 'https://www.economist.com', description: 'Global affairs analysis and opinion' },
      { title: 'Foreign Affairs', url: 'https://www.foreignaffairs.com/rss.xml', siteUrl: 'https://www.foreignaffairs.com', description: 'International relations and policy' },
    ],
  },
  {
    category: 'Economics & Markets',
    emoji: '📈',
    description: 'Economics, financial markets, and macro analysis',
    feeds: [
      { title: 'Marginal Revolution', url: 'https://marginalrevolution.com/feed', siteUrl: 'https://marginalrevolution.com', description: 'Economics blog by Tyler Cowen' },
      { title: 'Planet Money', url: 'https://feeds.npr.org/510289/podcast.xml', siteUrl: 'https://www.npr.org/sections/money', description: 'Economics made fun by NPR' },
      { title: 'Calculated Risk', url: 'https://www.calculatedriskblog.com/feeds/posts/default', siteUrl: 'https://www.calculatedriskblog.com', description: 'Economic analysis and housing data' },
      { title: 'Naked Capitalism', url: 'https://www.nakedcapitalism.com/feed', siteUrl: 'https://www.nakedcapitalism.com', description: 'Finance and economics analysis' },
      { title: 'The Big Picture', url: 'https://ritholtz.com/feed/', siteUrl: 'https://ritholtz.com', description: 'Markets and macroeconomics by Barry Ritholtz' },
      { title: 'VoxEU', url: 'https://feeds.feedburner.com/voxeu/fTWP', siteUrl: 'https://cepr.org/voxeu', description: 'Research-based economic policy analysis' },
    ],
  },
  {
    category: 'Climate & Environment',
    emoji: '🌿',
    description: 'Climate change, sustainability, and ecology',
    feeds: [
      { title: 'Inside Climate News', url: 'https://insideclimatenews.org/feed/', siteUrl: 'https://insideclimatenews.org', description: 'Pulitzer-winning climate reporting' },
      { title: 'Yale Environment 360', url: 'https://e360.yale.edu/feed', siteUrl: 'https://e360.yale.edu', description: 'Environmental news and analysis from Yale' },
      { title: 'Carbon Brief', url: 'https://www.carbonbrief.org/feed/', siteUrl: 'https://www.carbonbrief.org', description: 'Climate science and policy explained' },
      { title: 'The Guardian – Environment', url: 'https://www.theguardian.com/environment/rss', siteUrl: 'https://www.theguardian.com', description: 'Environmental news from The Guardian' },
      { title: 'Treehugger', url: 'https://www.treehugger.com/feeds/latest/', siteUrl: 'https://www.treehugger.com', description: 'Sustainability and green living' },
      { title: 'Mongabay', url: 'https://news.mongabay.com/feed/', siteUrl: 'https://news.mongabay.com', description: 'Conservation and wildlife news' },
      { title: 'RenewEconomy', url: 'https://reneweconomy.com.au/feed/', siteUrl: 'https://reneweconomy.com.au', description: 'Clean energy news and analysis' },
    ],
  },
  {
    category: 'Design & Product',
    emoji: '🎨',
    description: 'UX design, product thinking, and visual culture',
    feeds: [
      { title: 'A List Apart', url: 'https://alistapart.com/main/feed/', siteUrl: 'https://alistapart.com', description: 'Web standards and design patterns' },
      { title: 'UX Collective', url: 'https://uxdesign.cc/feed', siteUrl: 'https://uxdesign.cc', description: 'UX design articles and case studies' },
      { title: 'Nielsen Norman Group', url: 'https://www.nngroup.com/feed/rss/', siteUrl: 'https://www.nngroup.com', description: 'UX research and usability studies' },
      { title: 'Product Hunt', url: 'https://www.producthunt.com/feed', siteUrl: 'https://www.producthunt.com', description: 'Discover new products every day' },
      { title: 'Figma Blog', url: 'https://www.figma.com/blog/rss/', siteUrl: 'https://www.figma.com/blog', description: 'Design tools and community stories' },
      { title: 'Sidebar.io', url: 'https://sidebar.io/feed.xml', siteUrl: 'https://sidebar.io', description: '5 best design links every day' },
      { title: 'The UX of AI', url: 'https://www.theuxofai.com/rss', siteUrl: 'https://www.theuxofai.com', description: 'Designing AI-powered products' },
    ],
  },
  {
    category: 'Philosophy & Ideas',
    emoji: '💡',
    description: 'Big ideas, philosophy, and long-form thinking',
    feeds: [
      { title: 'Aeon', url: 'https://aeon.co/feed.rss', siteUrl: 'https://aeon.co', description: 'Philosophy, psychology, and big ideas' },
      { title: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/', siteUrl: 'https://www.theatlantic.com', description: 'Ideas and culture from The Atlantic' },
      { title: 'Nautilus', url: 'https://nautil.us/feed/', siteUrl: 'https://nautil.us', description: 'Science and philosophy magazine' },
      { title: 'The Marginalian', url: 'https://www.themarginalian.org/feed/', siteUrl: 'https://www.themarginalian.org', description: 'Maria Popova on ideas, art, and wonder' },
      { title: 'Longreads', url: 'https://longreads.com/feed/', siteUrl: 'https://longreads.com', description: 'Best long-form stories and essays' },
      { title: 'Quillette', url: 'https://quillette.com/feed/', siteUrl: 'https://quillette.com', description: 'Heterodox ideas and free thought' },
      { title: 'Arts & Letters Daily', url: 'http://www.aldaily.com/feed/', siteUrl: 'https://www.aldaily.com', description: 'Philosophy, arts, and literature links' },
    ],
  },
  {
    category: 'Law & Policy',
    emoji: '⚖️',
    description: 'Legal analysis, policy, and governance',
    feeds: [
      { title: 'SCOTUSblog', url: 'https://www.scotusblog.com/feed/', siteUrl: 'https://www.scotusblog.com', description: 'Supreme Court news and analysis' },
      { title: 'Lawfare', url: 'https://www.lawfaremedia.org/rssfeed', siteUrl: 'https://www.lawfaremedia.org', description: 'National security law and policy' },
      { title: 'Above the Law', url: 'https://abovethelaw.com/feed/', siteUrl: 'https://abovethelaw.com', description: 'Legal industry news and insights' },
      { title: 'ProPublica', url: 'https://www.propublica.org/feeds/propublica/main', siteUrl: 'https://www.propublica.org', description: 'Investigative journalism in public interest' },
      { title: 'Politico', url: 'https://www.politico.com/rss/politicopicks.xml', siteUrl: 'https://www.politico.com', description: 'Politics and policy news' },
      { title: 'Vox', url: 'https://www.vox.com/rss/index.xml', siteUrl: 'https://www.vox.com', description: 'Complex news explained clearly' },
      { title: 'The Hill', url: 'https://thehill.com/news/feed/', siteUrl: 'https://thehill.com', description: 'Congressional and political news' },
    ],
  },
  {
    category: 'Open Source',
    emoji: '🌐',
    description: 'Open source projects, Linux, and free software',
    feeds: [
      { title: 'Phoronix', url: 'https://www.phoronix.com/rss.php', siteUrl: 'https://www.phoronix.com', description: 'Linux hardware benchmarks and open source' },
      { title: "It's FOSS", url: 'https://itsfoss.com/feed/', siteUrl: 'https://itsfoss.com', description: 'Linux news and open source tutorials' },
      { title: 'LWN.net', url: 'https://lwn.net/headlines/rss', siteUrl: 'https://lwn.net', description: 'In-depth Linux and free software news' },
      { title: 'OSNews', url: 'https://www.osnews.com/feed/', siteUrl: 'https://www.osnews.com', description: 'Operating systems and open source' },
      { title: 'Opensource.com', url: 'https://opensource.com/feed', siteUrl: 'https://opensource.com', description: 'Open source stories and tutorials' },
      { title: 'GitHub Changelog', url: 'https://github.blog/changelog/feed/', siteUrl: 'https://github.blog/changelog', description: 'GitHub product updates and new features' },
      { title: 'The Register – Open Source', url: 'https://www.theregister.com/software/open_source/headlines.atom', siteUrl: 'https://www.theregister.com', description: 'Open source news and opinion' },
    ],
  },
  {
    category: 'Gaming',
    emoji: '🎮',
    description: 'Video games, esports, and gaming culture',
    feeds: [
      { title: 'IGN', url: 'https://feeds.ign.com/ign/all', siteUrl: 'https://www.ign.com', description: 'Games, movies, and entertainment' },
      { title: 'Polygon', url: 'https://www.polygon.com/rss/index.xml', siteUrl: 'https://www.polygon.com', description: 'Gaming culture, reviews, and guides' },
      { title: 'Eurogamer', url: 'https://www.eurogamer.net/feed/news', siteUrl: 'https://www.eurogamer.net', description: 'European gaming news and reviews' },
      { title: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed/', siteUrl: 'https://www.rockpapershotgun.com', description: 'PC gaming news and opinions' },
      { title: 'Kotaku', url: 'https://kotaku.com/rss', siteUrl: 'https://kotaku.com', description: 'Gaming culture and news' },
      { title: 'Giant Bomb', url: 'https://www.giantbomb.com/feeds/reviews/', siteUrl: 'https://www.giantbomb.com', description: 'Game reviews and video features' },
    ],
  },
  {
    category: 'Crypto & Web3',
    emoji: '₿',
    description: 'Blockchain, cryptocurrency, and decentralized tech',
    feeds: [
      { title: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', siteUrl: 'https://www.coindesk.com', description: 'Cryptocurrency and blockchain news' },
      { title: 'Decrypt', url: 'https://decrypt.co/feed', siteUrl: 'https://decrypt.co', description: 'Crypto news and deep analysis' },
      { title: 'CoinTelegraph', url: 'https://cointelegraph.com/rss', siteUrl: 'https://cointelegraph.com', description: 'Bitcoin and crypto market news' },
      { title: 'The Block', url: 'https://www.theblock.co/rss/articles', siteUrl: 'https://www.theblock.co', description: 'Institutional crypto research and news' },
      { title: 'Blockworks', url: 'https://blockworks.co/feed/', siteUrl: 'https://blockworks.co', description: 'Institutional crypto and DeFi news' },
      { title: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed', siteUrl: 'https://bitcoinmagazine.com', description: 'Bitcoin technology and culture' },
    ],
  },
  {
    category: 'Personal Finance',
    emoji: '💰',
    description: 'Money management, investing, and financial independence',
    feeds: [
      { title: 'Mr. Money Mustache', url: 'https://www.mrmoneymustache.com/feed/', siteUrl: 'https://www.mrmoneymustache.com', description: 'Early retirement and smart spending' },
      { title: 'Get Rich Slowly', url: 'https://www.getrichslowly.org/feed/', siteUrl: 'https://www.getrichslowly.org', description: 'Personal finance for regular people' },
      { title: 'NerdWallet', url: 'https://www.nerdwallet.com/blog/feed/', siteUrl: 'https://www.nerdwallet.com', description: 'Financial product comparisons and tips' },
      { title: 'Afford Anything', url: 'https://affordanything.com/feed/', siteUrl: 'https://affordanything.com', description: 'Financial independence and mindful spending' },
      { title: 'A Wealth of Common Sense', url: 'https://awealthofcommonsense.com/feed/', siteUrl: 'https://awealthofcommonsense.com', description: 'Simplified investing and market perspective' },
    ],
  },
  {
    category: 'Media & Entertainment',
    emoji: '🎬',
    description: 'Film, TV, music, and pop culture',
    feeds: [
      { title: 'Variety', url: 'https://variety.com/feed/', siteUrl: 'https://variety.com', description: 'Entertainment industry news and reviews' },
      { title: 'Deadline Hollywood', url: 'https://deadline.com/feed/', siteUrl: 'https://deadline.com', description: 'Breaking film and TV news' },
      { title: 'IndieWire', url: 'https://www.indiewire.com/feed/', siteUrl: 'https://www.indiewire.com', description: 'Film and TV criticism and news' },
      { title: 'Vulture', url: 'https://www.vulture.com/rss/', siteUrl: 'https://www.vulture.com', description: 'Culture and entertainment from New York' },
      { title: 'The AV Club', url: 'https://www.avclub.com/rss', siteUrl: 'https://www.avclub.com', description: 'Pop culture criticism and reviews' },
      { title: 'Pitchfork', url: 'https://pitchfork.com/rss/news/feed/json', siteUrl: 'https://pitchfork.com', description: 'Music news, reviews, and features' },
    ],
  },
  {
    category: 'Books & Literature',
    emoji: '📚',
    description: 'Books, writing, and literary culture',
    feeds: [
      { title: 'The New York Review of Books', url: 'https://www.nybooks.com/feeds/nybooks.rss', siteUrl: 'https://www.nybooks.com', description: 'Literary and intellectual essays' },
      { title: 'Literary Hub', url: 'https://lithub.com/feed/', siteUrl: 'https://lithub.com', description: 'Daily literary news and criticism' },
      { title: 'Electric Literature', url: 'https://electricliterature.com/feed/', siteUrl: 'https://electricliterature.com', description: 'Fiction, essays, and criticism' },
      { title: 'The Paris Review', url: 'https://www.theparisreview.org/blog/feed/', siteUrl: 'https://www.theparisreview.org', description: 'Fiction, poetry, and author interviews' },
      { title: 'Book Riot', url: 'https://bookriot.com/feed/', siteUrl: 'https://bookriot.com', description: 'All things books and reading culture' },
      { title: 'Five Books', url: 'https://fivebooks.com/feed/', siteUrl: 'https://fivebooks.com', description: 'Expert reading recommendations by topic' },
    ],
  },
  {
    category: 'Education & Learning',
    emoji: '🎓',
    description: 'Education technology, research, and learning',
    feeds: [
      { title: 'Edutopia', url: 'https://www.edutopia.org/feeds/posts', siteUrl: 'https://www.edutopia.org', description: 'Innovative K-12 education ideas' },
      { title: 'Inside Higher Ed', url: 'https://www.insidehighered.com/rss', siteUrl: 'https://www.insidehighered.com', description: 'Higher education news and analysis' },
      { title: 'EdSurge', url: 'https://www.edsurge.com/rss/articles', siteUrl: 'https://www.edsurge.com', description: 'Education technology news' },
      { title: 'The Chronicle of Higher Education', url: 'https://www.chronicle.com/page/feed?context=rss', siteUrl: 'https://www.chronicle.com', description: 'Academia and higher education' },
      { title: 'Mind/Shift', url: 'https://feeds.npr.org/kqed/MindShift', siteUrl: 'https://www.kqed.org/mindshift', description: 'How learning and education are changing' },
    ],
  },
];

export const DEFAULT_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes (legacy, kept for fallback)

export const AUTO_REFRESH_OPTIONS = [
  { label: 'Off',        value: 0   },
  { label: '15 minutes', value: 15  },
  { label: '30 minutes', value: 30  },
  { label: '1 hour',     value: 60  },
  { label: '2 hours',    value: 120 },
];

export function getAutoRefreshMinutes() {
  return readStoredNumber('tenwise-auto-refresh', 30);
}

export function saveAutoRefreshMinutes(minutes) {
  writeStored('tenwise-auto-refresh', minutes);
}

export const HIGHLIGHT_COLORS = {
  yellow: '#fef08a',
  green:  '#bbf7d0',
  blue:   '#bfdbfe',
  pink:   '#fecdd3',
};

export const VIEW_TYPES = {
  ALL: 'all',
  TODAY: 'today',
  SAVED: 'saved',
  FEED: 'feed',
  FOLDER: 'folder',
  LIBRARY: 'library',
};
