"""
Ollama-powered HTML analyzer for dynamic CSS selector adaptation.
Uses NLP to intelligently identify and adapt to website structure changes.
"""

import requests
import json
import logging
from typing import Dict, List, Optional, Any
from bs4 import BeautifulSoup
import re

logger = logging.getLogger(__name__)


class OllamaHTMLAnalyzer:
    """
    Analyzes HTML structure using Ollama NLP to dynamically find
    the correct CSS selectors when websites change their structure.
    """

    def __init__(self, ollama_host: str = "http://ollama:11434"):
        self.ollama_host = ollama_host
        self.nlp_host = "http://nlp-processor:8021"

    def analyze_html_for_tracklists(self, html_content: str) -> Dict[str, Any]:
        """
        Analyze HTML to find tracklist links and structure patterns.
        Returns suggested selectors and extraction patterns.
        """
        soup = BeautifulSoup(html_content, 'html.parser')

        # Strategy 1: Look for links with music-related keywords in href
        music_link_patterns = [
            '/tracklist/', '/setlist/', '/mix/', '/playlist/',
            '/dj/', '/artist/', '/track/', '/song/'
        ]

        potential_selectors = []
        found_elements = []

        # Find all links and analyze their patterns
        for pattern in music_link_patterns:
            links = soup.find_all('a', href=lambda x: x and pattern in x.lower())
            if links:
                # Analyze parent structure to find common selector
                for link in links[:5]:  # Sample first 5
                    # Get parent classes
                    parent = link.parent
                    if parent and parent.get('class'):
                        parent_class = '.'.join(parent.get('class'))
                        selector = f"div.{parent_class} a"
                        if selector not in potential_selectors:
                            potential_selectors.append(selector)
                            found_elements.append({
                                'selector': selector,
                                'pattern': pattern,
                                'example_href': link.get('href', ''),
                                'example_text': link.get_text(strip=True)[:100]
                            })

        # Strategy 2: Analyze text content for music-related patterns
        text_patterns = {
            'dj_sets': r'(?i)(dj\s+set|live\s+set|mix\s+by|mixed\s+by)',
            'tracklist': r'(?i)(tracklist|setlist|playlist)',
            'artist_names': r'(?i)(feat\.|featuring|vs\.|versus|remix)',
            'event_names': r'(?i)(festival|club|event|party|live\s+at)'
        }

        content_areas = []
        for name, pattern in text_patterns.items():
            elements = soup.find_all(text=re.compile(pattern))
            for elem in elements[:3]:  # Sample first 3
                parent = elem.parent
                if parent and parent.name == 'a':
                    href = parent.get('href', '')
                    if href:
                        # Find a selector for this element
                        classes = parent.get('class', [])
                        id_attr = parent.get('id', '')

                        if classes:
                            selector = f"a.{'.'.join(classes)}"
                        elif id_attr:
                            selector = f"a#{id_attr}"
                        else:
                            # Try parent's selector
                            grandparent = parent.parent
                            if grandparent and grandparent.get('class'):
                                gp_class = '.'.join(grandparent.get('class'))
                                selector = f"div.{gp_class} a"
                            else:
                                selector = "a[href*='/']"

                        content_areas.append({
                            'type': name,
                            'selector': selector,
                            'example_href': href,
                            'example_text': elem.strip()[:100]
                        })

        # Strategy 3: Use NLP to identify semantic patterns
        # Send sample to NLP processor for entity extraction
        sample_text = soup.get_text()[:5000]  # First 5KB of text
        nlp_insights = self._analyze_with_nlp(sample_text)

        # Combine all findings
        result = {
            'success': len(potential_selectors) > 0 or len(content_areas) > 0,
            'potential_selectors': potential_selectors,
            'found_elements': found_elements,
            'content_patterns': content_areas,
            'nlp_insights': nlp_insights,
            'recommended_selectors': self._recommend_selectors(
                potential_selectors, found_elements, content_areas
            )
        }

        logger.info(f"HTML analysis complete: {len(result['recommended_selectors'])} selectors recommended")
        return result

    def _analyze_with_nlp(self, text: str) -> Dict[str, Any]:
        """Use NLP processor to extract entities and patterns."""
        try:
            response = requests.post(
                f"{self.nlp_host}/analyze/entities",
                json={"text": text},
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"NLP analysis failed: {response.status_code}")
                return {}
        except Exception as e:
            logger.error(f"NLP processor error: {e}")
            return {}

    def _recommend_selectors(
        self,
        potential_selectors: List[str],
        found_elements: List[Dict],
        content_areas: List[Dict]
    ) -> List[Dict[str, str]]:
        """
        Recommend the best selectors based on analysis.
        """
        recommendations = []

        # Prioritize selectors that found tracklist links
        for elem in found_elements:
            if '/tracklist/' in elem.get('pattern', ''):
                recommendations.append({
                    'selector': elem['selector'],
                    'type': 'tracklist_link',
                    'confidence': 'high',
                    'example': elem.get('example_text', '')
                })

        # Add content-based selectors
        for area in content_areas:
            if area['type'] in ['tracklist', 'dj_sets']:
                recommendations.append({
                    'selector': area['selector'],
                    'type': area['type'],
                    'confidence': 'medium',
                    'example': area.get('example_text', '')
                })

        # If no specific patterns found, suggest generic selectors
        if not recommendations:
            recommendations.extend([
                {
                    'selector': 'a[href*="/tracklist/"]',
                    'type': 'generic_tracklist',
                    'confidence': 'low',
                    'example': 'Generic tracklist link pattern'
                },
                {
                    'selector': 'div.search-results a',
                    'type': 'search_results',
                    'confidence': 'low',
                    'example': 'Common search results pattern'
                }
            ])

        return recommendations[:5]  # Return top 5 recommendations

    def test_selector(self, html_content: str, selector: str) -> Dict[str, Any]:
        """Test if a selector returns valid results."""
        soup = BeautifulSoup(html_content, 'html.parser')

        try:
            elements = soup.select(selector)
            return {
                'success': len(elements) > 0,
                'count': len(elements),
                'examples': [
                    {
                        'text': elem.get_text(strip=True)[:100],
                        'href': elem.get('href', '') if elem.name == 'a' else ''
                    }
                    for elem in elements[:3]
                ]
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'count': 0,
                'examples': []
            }

    def adapt_spider_selectors(self, spider_name: str, html_sample: str) -> Dict[str, str]:
        """
        Analyze HTML and return adapted selectors for a specific spider.
        """
        analysis = self.analyze_html_for_tracklists(html_sample)

        # Map spider types to selector requirements
        spider_configs = {
            '1001tracklists': {
                'tracklist_link': 'a[href*="/tracklist/"]',
                'track_item': 'div.tlpItem',
                'artist_name': 'span.artistName',
                'track_name': 'span.trackName'
            },
            'mixesdb': {
                'mix_link': 'a[href*="/mix/"]',
                'dj_name': 'span.djName',
                'mix_title': 'h2.mixTitle'
            },
            'setlistfm': {
                'setlist_link': 'a[href*="/setlist/"]',
                'song_item': 'div.song',
                'venue_name': 'span.venue'
            }
        }

        # Get base config for spider
        base_config = spider_configs.get(spider_name, {})

        # Override with detected selectors
        found_improvements = False
        if analysis['success'] and analysis['recommended_selectors']:
            for recommendation in analysis['recommended_selectors']:
                selector_type = recommendation['type']
                if selector_type in base_config:
                    # Test if the new selector works
                    test_result = self.test_selector(html_sample, recommendation['selector'])
                    if test_result['success']:
                        base_config[selector_type] = recommendation['selector']
                        found_improvements = True
                        logger.info(f"Updated {selector_type} selector to: {recommendation['selector']}")

        # If traditional methods failed, try Ollama for semantic analysis
        if not found_improvements:
            logger.info(f"Traditional analysis found limited improvements for {spider_name}, trying Ollama...")
            ollama_result = self.analyze_html_with_ollama(html_sample, f"{spider_name} content")

            if ollama_result['success'] and ollama_result['selectors']:
                # Test Ollama-suggested selectors
                for selector_info in ollama_result['selectors']:
                    selector = selector_info['selector']
                    test_result = self.test_selector(html_sample, selector)

                    if test_result['success'] and test_result['count'] > 0:
                        # Try to map to appropriate selector type
                        explanation = selector_info['explanation'].lower()

                        # Map based on selector patterns and explanation
                        if 'href' in selector or 'link' in explanation:
                            base_config['tracklist_link'] = selector
                            found_improvements = True
                            logger.info(f"Ollama found link selector: {selector}")
                        elif any(word in explanation for word in ['artist', 'creator', 'by']):
                            base_config['artist_name'] = selector
                            found_improvements = True
                            logger.info(f"Ollama found artist selector: {selector}")
                        elif any(word in explanation for word in ['title', 'track', 'song', 'name']):
                            base_config['track_name'] = selector
                            found_improvements = True
                            logger.info(f"Ollama found track selector: {selector}")
                        else:
                            # If we can't categorize it, use it as tracklist_link (most important)
                            base_config['tracklist_link'] = selector
                            found_improvements = True
                            logger.info(f"Ollama found general selector: {selector}")

        return base_config

    def analyze_html_with_ollama(self, html_content: str, target_content_type: str = "music tracklists") -> Dict[str, Any]:
        """
        Use Ollama for semantic HTML analysis when traditional methods fail.
        """
        # Simplify HTML for analysis
        soup = BeautifulSoup(html_content, 'html.parser')

        # Remove scripts and style elements
        for script in soup(["script", "style", "noscript"]):
            script.decompose()

        # Get a much smaller, focused sample of the HTML
        text_content = soup.get_text()[:500]   # Reduced from 2000 to 500 chars
        html_structure = str(soup)[:800]       # Reduced from 1500 to 800 chars of HTML

        prompt = f"""Find CSS selectors for {target_content_type} in this HTML:

{html_structure}

Text: {text_content}

Return 2-3 CSS selectors for music links, one per line:"""

        try:
            response = requests.post(
                f"{self.ollama_host}/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "top_p": 0.9,
                        "num_predict": 30
                    }
                },
                timeout=60
            )

            if response.status_code == 200:
                result = response.json()
                analysis_text = result.get('response', '')

                # Parse the response to extract selectors
                selectors = []
                lines = analysis_text.split('\n')
                for line in lines:
                    line = line.strip()
                    # Look for CSS selector patterns
                    if '[' in line and ']' in line:
                        # Extract attribute selectors like a[href*="/mix/"]
                        import re
                        matches = re.findall(r'[a-z]+\[[^\]]+\]', line)
                        for match in matches:
                            selectors.append({
                                'selector': match,
                                'explanation': line,
                                'source': 'ollama_semantic'
                            })
                    elif line.startswith('.') or line.startswith('#') or (line.startswith(('a ', 'div ', 'span ')) and ' ' in line):
                        # Extract class/id selectors or element selectors
                        selector = line.split()[0] if ' ' in line else line
                        if selector and len(selector) > 1:
                            selectors.append({
                                'selector': selector,
                                'explanation': line,
                                'source': 'ollama_semantic'
                            })

                return {
                    'success': True,
                    'selectors': selectors,
                    'analysis': analysis_text
                }
            else:
                logger.warning(f"Ollama request failed: {response.status_code}")
                return {'success': False, 'error': f'HTTP {response.status_code}'}

        except requests.exceptions.RequestException as e:
            logger.warning(f"Failed to connect to Ollama: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Ollama analysis error: {e}")
            return {'success': False, 'error': str(e)}


# Integration function for scrapers
def get_adaptive_selectors(spider_name: str, response_text: str) -> Dict[str, str]:
    """
    Main function to be called by scrapers when they need to adapt selectors.
    """
    analyzer = OllamaHTMLAnalyzer()
    return analyzer.adapt_spider_selectors(spider_name, response_text)