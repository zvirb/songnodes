#!/usr/bin/env python3
"""
Web UI Test using basic HTTP requests and content analysis
Since we can't access browser automation tools directly,
we'll test what we can via HTTP requests and create a report
"""

import requests
import json
import re
import time
from urllib.parse import urljoin

class WebUITester:
    def __init__(self, base_url="http://localhost:3006"):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_results = []

    def log_test(self, test_name, status, details=None):
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.test_results.append(result)
        status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_icon} {test_name}")
        if details:
            print(f"   {details}")

    def test_frontend_accessibility(self):
        """Test if frontend is accessible"""
        try:
            response = self.session.get(self.base_url, timeout=5)
            if response.status_code == 200:
                # Check for React app indicators
                content = response.text
                has_react = "react" in content.lower() or "vite" in content.lower()
                has_div_root = 'id="root"' in content

                if has_react and has_div_root:
                    self.log_test("Frontend Accessibility", "PASS",
                                f"Status: {response.status_code}, React app detected")
                    return True
                else:
                    self.log_test("Frontend Accessibility", "WARN",
                                f"Status: {response.status_code}, but React indicators missing")
                    return False
            else:
                self.log_test("Frontend Accessibility", "FAIL",
                            f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Frontend Accessibility", "FAIL", str(e))
            return False

    def test_data_files(self):
        """Test if data files are accessible"""
        data_files = {
            "Live Performance Data": "/live-performance-data.json"
        }

        all_passed = True
        for name, path in data_files.items():
            try:
                url = urljoin(self.base_url, path)
                response = self.session.get(url, timeout=5)

                if response.status_code == 200:
                    try:
                        data = response.json()
                        nodes = len(data.get('nodes', []))
                        edges = len(data.get('edges', []))
                        self.log_test(f"{name} File", "PASS",
                                    f"{nodes} nodes, {edges} edges")

                        # Analyze data content
                        if nodes > 0:
                            node_types = {}
                            for node in data['nodes'][:10]:  # Sample first 10
                                node_type = node.get('type', 'unknown')
                                node_types[node_type] = node_types.get(node_type, 0) + 1

                            type_summary = ", ".join([f"{k}: {v}" for k, v in node_types.items()])
                            self.log_test(f"{name} Content Analysis", "PASS",
                                        f"Node types: {type_summary}")
                    except json.JSONDecodeError:
                        self.log_test(f"{name} File", "FAIL", "Invalid JSON")
                        all_passed = False
                else:
                    self.log_test(f"{name} File", "FAIL", f"HTTP {response.status_code}")
                    all_passed = False
            except Exception as e:
                self.log_test(f"{name} File", "FAIL", str(e))
                all_passed = False

        return all_passed

    def test_static_assets(self):
        """Test if key static assets are loading"""
        assets_to_check = [
            "/manifest.json",
            "/favicon.ico"
        ]

        for asset in assets_to_check:
            try:
                url = urljoin(self.base_url, asset)
                response = self.session.get(url, timeout=3)

                if response.status_code == 200:
                    self.log_test(f"Asset {asset}", "PASS", f"Size: {len(response.content)} bytes")
                else:
                    self.log_test(f"Asset {asset}", "WARN", f"HTTP {response.status_code}")
            except Exception as e:
                self.log_test(f"Asset {asset}", "FAIL", str(e))

    def analyze_html_content(self):
        """Analyze the HTML content for clues about the application state"""
        try:
            response = self.session.get(self.base_url, timeout=5)
            if response.status_code == 200:
                content = response.text

                # Check for JavaScript errors in HTML
                if "error" in content.lower():
                    error_count = content.lower().count("error")
                    self.log_test("HTML Error Analysis", "WARN",
                                f"Found {error_count} instances of 'error' in HTML")

                # Check for script tags
                script_tags = re.findall(r'<script[^>]*src="([^"]*)"', content)
                if script_tags:
                    self.log_test("JavaScript Assets", "PASS",
                                f"Found {len(script_tags)} script files")
                else:
                    self.log_test("JavaScript Assets", "WARN", "No script tags found")

                # Check for CSS
                css_links = re.findall(r'<link[^>]*href="([^"]*\.css[^"]*)"', content)
                if css_links:
                    self.log_test("CSS Assets", "PASS",
                                f"Found {len(css_links)} CSS files")

                # Check for div#root
                if 'id="root"' in content:
                    self.log_test("React Root Element", "PASS", "Found div#root")
                else:
                    self.log_test("React Root Element", "FAIL", "No div#root found")

        except Exception as e:
            self.log_test("HTML Content Analysis", "FAIL", str(e))

    def create_dev_console_simulation(self):
        """Simulate what we'd expect to see in dev console"""
        print("\n" + "="*60)
        print("🔍 SIMULATED DEV CONSOLE ANALYSIS")
        print("="*60)

        # Check what a browser would try to load
        expected_requests = [
            f"{self.base_url}/",
            f"{self.base_url}/live-performance-data.json"
        ]

        print("\n📡 Expected Network Requests:")
        for url in expected_requests:
            try:
                response = self.session.get(url, timeout=3)
                status_icon = "✅" if response.status_code == 200 else "❌"
                print(f"  {status_icon} {url} → {response.status_code}")
            except Exception as e:
                print(f"  ❌ {url} → Error: {e}")

        print("\n📊 Expected Console Messages:")
        print("  🎵 Attempting to load live performance data...")

        # Check if data would load successfully
        try:
            data_response = self.session.get(f"{self.base_url}/live-performance-data.json")
            if data_response.status_code == 200:
                data = data_response.json()
                print(f"  ✅ Loaded live performance data: {{ nodes: {len(data.get('nodes', []))}, edges: {len(data.get('edges', []))} }}")
                print(f"  ✅ Setting nodes and edges: {{ nodes: {len(data.get('nodes', []))}, edges: {len(data.get('edges', []))} }}")
            else:
                print("  ❌ Failed to load live performance data")
        except Exception as e:
            print(f"  ❌ Data loading error: {e}")

    def run_all_tests(self):
        """Run all tests and generate report"""
        print("🧪 Starting Web UI Test Suite")
        print("="*50)

        # Run tests
        self.test_frontend_accessibility()
        self.test_data_files()
        self.test_static_assets()
        self.analyze_html_content()

        # Generate report
        print("\n" + "="*50)
        print("📊 TEST SUMMARY")
        print("="*50)

        passed = len([r for r in self.test_results if r['status'] == 'PASS'])
        failed = len([r for r in self.test_results if r['status'] == 'FAIL'])
        warned = len([r for r in self.test_results if r['status'] == 'WARN'])

        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️  Warnings: {warned}")

        if failed == 0:
            print("\n🎉 All critical tests passed!")
            print("The frontend should be loading data correctly.")
        else:
            print("\n⚠️ Some tests failed - check the details above.")

        # Dev console simulation
        self.create_dev_console_simulation()

        return self.test_results

def main():
    tester = WebUITester()
    results = tester.run_all_tests()

    # Save results
    with open("webui-test-results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n📄 Test results saved to webui-test-results.json")

if __name__ == "__main__":
    main()
