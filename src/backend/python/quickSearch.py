import sys, webbrowser, time, requests, bs4, urllib.parse

# -------------------------------
# 1. Productivity Profiles
# -------------------------------
profiles = {
    "work": [
        "https://mail.google.com",
        "https://calendar.google.com",
        "https://slack.com",
        "https://notion.so",
        "https://drive.google.com"
    ],
    "coding": [
        "https://stackoverflow.com",
        "https://github.com",
        "https://docs.python.org/3/",
        "https://chat.openai.com"
    ],
    "research": [
        "https://scholar.google.com",
        "https://wikipedia.org",
        "https://news.google.com",
        "https://www.researchgate.net"
    ],
    "content": [
        "https://canva.com",
        "https://notion.so",
        "https://grammarly.com",
        "https://medium.com"
    ]
}

# -------------------------------
# 2. Scraping Helper Function (Jumia)
# -------------------------------
def scrape_jumia(query):
    url = f"https://www.jumia.co.ke/catalog/?q={query}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        soup = bs4.BeautifulSoup(res.text, "html.parser")
        items = soup.select("article.prd")
        results = []
        for item in items[:5]:
            title_elem = item.select_one("h3.name")
            price_elem = item.select_one("div.prc")
            link_elem = item.select_one("a.core")
            if title_elem and price_elem and link_elem:
                title = title_elem.get_text(strip=True)
                price = price_elem.get_text(strip=True)
                link = "https://www.jumia.co.ke" + link_elem.get("href")
                results.append((title, price, link))
        return results
    except Exception as e:
        print("⚠️ Jumia scrape failed:", e)
        return []

# -------------------------------
# 3. Multi-store Product Search
# -------------------------------
def search_product(product_name):
    query = product_name.replace(" ", "+")
    print(f"\n🔍 Searching for: {product_name}\n")

    # ---- Jumia ----
    print("--- Jumia ---")
    jumia_results = scrape_jumia(query)
    if jumia_results:
        for title, price, link in jumia_results:
            print(f"{title} | {price}")
            webbrowser.open_new_tab(link)
            time.sleep(1)
    else:
        print("No results found.\n")

    # ---- Amazon ----
    amazon_url = f"https://www.amazon.com/s?k={query}"
    print("\n--- Amazon ---")
    print(f"Opening Amazon search page: {amazon_url}\n")
    webbrowser.open_new_tab(amazon_url)
    time.sleep(1)

    # ---- AliExpress ----
    aliexpress_url = f"https://www.aliexpress.com/wholesale?SearchText={query}"
    print("--- AliExpress ---")
    print(f"Opening AliExpress search page: {aliexpress_url}\n")
    webbrowser.open_new_tab(aliexpress_url)
    time.sleep(1)

    # ---- Ebay ----
    ebay_url = f"https://www.ebay.com/sch/i.html?_nkw={query}"
    print("--- Ebay ---")
    print(f"Opening eBay search page: {ebay_url}\n")
    webbrowser.open_new_tab(ebay_url)
    time.sleep(1)

# -------------------------------
# 4. Research / Academic Search
# -------------------------------
def search_research(topic):
    query = urllib.parse.quote_plus(topic)
    print(f"\n📚 Research Mode: {topic}\n")

    sources = {
        "Google Scholar": f"https://scholar.google.com/scholar?q={query}",
        "Wikipedia": f"https://en.wikipedia.org/wiki/{query.replace('+', '_')}",
        "Google News": f"https://news.google.com/search?q={query}",
        "YouTube": f"https://www.youtube.com/results?search_query={query}",
        "Twitter/X": f"https://twitter.com/search?q={query}&src=typed_query"
    }

    for name, url in sources.items():
        print(f"Opening {name}: {url}")
        webbrowser.open_new_tab(url)
        time.sleep(1)

# -------------------------------
# 5. Main Script
# -------------------------------
if len(sys.argv) < 2:
    print("Usage: python launcher.py <profile-name | product:search-term | research:topic>")
    print("Profiles:", ", ".join(profiles.keys()))
    sys.exit(1)

mode = sys.argv[1].lower()

# If input matches a profile → launch profile
if mode in profiles:
    print(f"Launching profile: {mode}")
    for url in profiles[mode]:
        print("Opening:", url)
        webbrowser.open_new_tab(url)
        time.sleep(1)

# If input starts with "product:" → product search
elif mode.startswith("product:"):
    product_name = " ".join(sys.argv[1:])[8:].strip()
    search_product(product_name)

# If input starts with "research:" → research search
elif mode.startswith("research:"):
    topic = " ".join(sys.argv[1:])[9:].strip()
    search_research(topic)

# Otherwise default → treat input as product search
else:
    product_name = " ".join(sys.argv[1:])
    search_product(product_name)
