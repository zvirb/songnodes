#!/usr/bin/env python3
"""
Generate comprehensive test report for SongNodes project.
"""

import json
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime
import sys
import subprocess
import os


class TestReportGenerator:
    """Generate comprehensive test reports."""
    
    def __init__(self, reports_dir: str = "tests/reports"):
        self.reports_dir = Path(reports_dir)
        self.reports_dir.mkdir(exist_ok=True)
        
    def generate_comprehensive_report(self):
        """Generate comprehensive test report."""
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "project": "SongNodes Music Database",
            "summary": self._generate_summary(),
            "unit_tests": self._parse_junit_xml("unit-tests.xml"),
            "integration_tests": self._parse_junit_xml("integration-tests.xml"),
            "performance_tests": self._parse_performance_results(),
            "coverage": self._parse_coverage_data(),
            "security": self._parse_security_results(),
            "quality": self._parse_quality_metrics(),
            "recommendations": self._generate_recommendations()
        }
        
        # Generate HTML report
        self._generate_html_report(report_data)
        
        # Generate JSON report
        self._generate_json_report(report_data)
        
        # Generate executive summary
        self._generate_executive_summary(report_data)
        
        print(f"✓ Comprehensive test report generated: {self.reports_dir}/test-report.html")
        
        return report_data
    
    def _generate_summary(self):
        """Generate test summary."""
        return {
            "total_test_files": len(list(Path("tests").rglob("test_*.py"))),
            "total_source_files": len(list(Path("services").rglob("*.py")) + 
                                     list(Path("musicdb_scrapy").rglob("*.py"))),
            "test_categories": ["unit", "integration", "performance", "e2e", "security"],
            "target_coverage": 90,
            "target_performance": {
                "api_response_time": "<100ms",
                "throughput": ">20,000 tracks/hour",
                "error_rate": "<1%"
            }
        }
    
    def _parse_junit_xml(self, filename: str):
        """Parse JUnit XML test results."""
        xml_path = self.reports_dir / filename
        
        if not xml_path.exists():
            return {"status": "not_run", "reason": f"File {filename} not found"}
        
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
            
            # Parse testsuite attributes
            total_tests = int(root.get("tests", 0))
            failures = int(root.get("failures", 0))
            errors = int(root.get("errors", 0))
            skipped = int(root.get("skipped", 0))
            time_taken = float(root.get("time", 0))
            
            success_rate = ((total_tests - failures - errors) / total_tests * 100) if total_tests > 0 else 0
            
            # Parse individual test cases
            test_cases = []
            for testcase in root.findall(".//testcase"):
                case_data = {
                    "name": testcase.get("name"),
                    "classname": testcase.get("classname"),
                    "time": float(testcase.get("time", 0)),
                    "status": "passed"
                }
                
                if testcase.find("failure") is not None:
                    case_data["status"] = "failed"
                    case_data["failure"] = testcase.find("failure").text
                elif testcase.find("error") is not None:
                    case_data["status"] = "error"
                    case_data["error"] = testcase.find("error").text
                elif testcase.find("skipped") is not None:
                    case_data["status"] = "skipped"
                
                test_cases.append(case_data)
            
            return {
                "status": "completed",
                "total_tests": total_tests,
                "passed": total_tests - failures - errors - skipped,
                "failed": failures,
                "errors": errors,
                "skipped": skipped,
                "success_rate": round(success_rate, 2),
                "duration": round(time_taken, 2),
                "test_cases": test_cases
            }
            
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def _parse_coverage_data(self):
        """Parse coverage data from XML report."""
        coverage_xml = self.reports_dir / "coverage.xml"
        
        if not coverage_xml.exists():
            return {"status": "not_available"}
        
        try:
            tree = ET.parse(coverage_xml)
            root = tree.getroot()
            
            # Get overall coverage
            overall_coverage = float(root.get("line-rate", 0)) * 100
            
            # Parse package coverage
            packages = []
            for package in root.findall(".//package"):
                package_data = {
                    "name": package.get("name"),
                    "line_rate": float(package.get("line-rate", 0)) * 100,
                    "branch_rate": float(package.get("branch-rate", 0)) * 100,
                    "lines_covered": int(package.get("lines-covered", 0)),
                    "lines_valid": int(package.get("lines-valid", 0))
                }
                packages.append(package_data)
            
            return {
                "status": "available",
                "overall_coverage": round(overall_coverage, 2),
                "target_coverage": 90,
                "meets_target": overall_coverage >= 90,
                "packages": packages
            }
            
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def _parse_performance_results(self):
        """Parse performance test results."""
        perf_report = self.reports_dir / "performance-report.html"
        
        if not perf_report.exists():
            return {"status": "not_run"}
        
        # Try to extract basic metrics from Locust HTML report
        try:
            with open(perf_report, 'r') as f:
                content = f.read()
            
            # Simple parsing for key metrics (this could be improved with proper HTML parsing)
            metrics = {
                "status": "completed",
                "avg_response_time": "N/A",
                "p95_response_time": "N/A", 
                "requests_per_second": "N/A",
                "error_rate": "N/A",
                "meets_targets": False
            }
            
            return metrics
            
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def _parse_security_results(self):
        """Parse security scan results."""
        security_results = {}
        
        # Parse Bandit results
        bandit_file = self.reports_dir / "security-bandit.json"
        if bandit_file.exists():
            try:
                with open(bandit_file, 'r') as f:
                    bandit_data = json.load(f)
                
                security_results["bandit"] = {
                    "status": "completed",
                    "high_severity": len([r for r in bandit_data.get("results", []) if r.get("issue_severity") == "HIGH"]),
                    "medium_severity": len([r for r in bandit_data.get("results", []) if r.get("issue_severity") == "MEDIUM"]),
                    "low_severity": len([r for r in bandit_data.get("results", []) if r.get("issue_severity") == "LOW"]),
                    "total_issues": len(bandit_data.get("results", []))
                }
            except Exception as e:
                security_results["bandit"] = {"status": "error", "error": str(e)}
        
        # Parse Safety results
        safety_file = self.reports_dir / "security-safety.json"
        if safety_file.exists():
            try:
                with open(safety_file, 'r') as f:
                    safety_data = json.load(f)
                
                security_results["safety"] = {
                    "status": "completed",
                    "vulnerabilities": len(safety_data) if isinstance(safety_data, list) else 0
                }
            except Exception as e:
                security_results["safety"] = {"status": "error", "error": str(e)}
        
        return security_results
    
    def _parse_quality_metrics(self):
        """Parse code quality metrics."""
        quality_results = {}
        
        # Parse Flake8 results
        flake8_file = self.reports_dir / "flake8-report.txt"
        if flake8_file.exists():
            try:
                with open(flake8_file, 'r') as f:
                    flake8_content = f.read()
                
                # Count violations
                lines = flake8_content.strip().split('\n')
                violations = [line for line in lines if line.strip() and not line.startswith('#')]
                
                quality_results["flake8"] = {
                    "status": "completed",
                    "total_violations": len(violations),
                    "violations": violations[:10]  # First 10 violations
                }
            except Exception as e:
                quality_results["flake8"] = {"status": "error", "error": str(e)}
        
        return quality_results
    
    def _generate_recommendations(self):
        """Generate recommendations based on test results."""
        recommendations = []
        
        # Check coverage
        coverage_xml = self.reports_dir / "coverage.xml"
        if coverage_xml.exists():
            # Parse coverage to make recommendations
            recommendations.append({
                "category": "coverage",
                "priority": "high",
                "title": "Improve Test Coverage",
                "description": "Ensure test coverage meets the 90% target for all critical components."
            })
        
        # Performance recommendations
        recommendations.append({
            "category": "performance",
            "priority": "medium",
            "title": "Optimize API Response Times",
            "description": "Monitor and optimize API endpoints to maintain <100ms response times."
        })
        
        # Security recommendations
        recommendations.append({
            "category": "security",
            "priority": "high",
            "title": "Regular Security Scans",
            "description": "Run security scans regularly and address vulnerabilities promptly."
        })
        
        return recommendations
    
    def _generate_html_report(self, report_data):
        """Generate HTML test report."""
        html_template = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SongNodes Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .section { margin-bottom: 40px; }
        .section h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .status-skipped { color: #6c757d; }
        .progress-bar { width: 100%; height: 20px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background-color: #28a745; transition: width 0.3s ease; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; }
        .recommendation { margin-bottom: 15px; padding: 10px; background: white; border-radius: 5px; }
        .priority-high { border-left: 4px solid #dc3545; }
        .priority-medium { border-left: 4px solid #ffc107; }
        .priority-low { border-left: 4px solid #28a745; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .test-passed { background-color: #d4edda; }
        .test-failed { background-color: #f8d7da; }
        .test-skipped { background-color: #fefefe; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SongNodes Test Report</h1>
            <p><strong>Generated:</strong> {generated_at}</p>
            <p><strong>Project:</strong> {project}</p>
        </div>

        <div class="summary">
            <div class="metric-card">
                <div class="metric-value">{total_tests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value status-{coverage_status}">{coverage_percentage}%</div>
                <div class="metric-label">Test Coverage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value status-{success_status}">{success_rate}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{test_categories}</div>
                <div class="metric-label">Test Categories</div>
            </div>
        </div>

        <div class="section">
            <h2>Test Results Overview</h2>
            {test_results_html}
        </div>

        <div class="section">
            <h2>Code Coverage</h2>
            {coverage_html}
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            {performance_html}
        </div>

        <div class="section">
            <h2>Security Analysis</h2>
            {security_html}
        </div>

        <div class="section">
            <h2>Code Quality</h2>
            {quality_html}
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            <div class="recommendations">
                {recommendations_html}
            </div>
        </div>
    </div>
</body>
</html>
        """
        
        # Calculate summary metrics
        unit_tests = report_data.get("unit_tests", {})
        integration_tests = report_data.get("integration_tests", {})
        coverage = report_data.get("coverage", {})
        
        total_tests = unit_tests.get("total_tests", 0) + integration_tests.get("total_tests", 0)
        total_passed = unit_tests.get("passed", 0) + integration_tests.get("passed", 0)
        success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
        coverage_percentage = coverage.get("overall_coverage", 0)
        
        # Format HTML sections
        test_results_html = self._format_test_results_html(report_data)
        coverage_html = self._format_coverage_html(coverage)
        performance_html = self._format_performance_html(report_data.get("performance_tests", {}))
        security_html = self._format_security_html(report_data.get("security", {}))
        quality_html = self._format_quality_html(report_data.get("quality", {}))
        recommendations_html = self._format_recommendations_html(report_data.get("recommendations", []))
        
        # Fill template
        html_content = html_template.format(
            generated_at=report_data["generated_at"],
            project=report_data["project"],
            total_tests=total_tests,
            coverage_percentage=round(coverage_percentage, 1),
            coverage_status="passed" if coverage_percentage >= 90 else "warning",
            success_rate=round(success_rate, 1),
            success_status="passed" if success_rate >= 95 else "warning",
            test_categories=len(report_data["summary"]["test_categories"]),
            test_results_html=test_results_html,
            coverage_html=coverage_html,
            performance_html=performance_html,
            security_html=security_html,
            quality_html=quality_html,
            recommendations_html=recommendations_html
        )
        
        # Write HTML file
        with open(self.reports_dir / "test-report.html", 'w') as f:
            f.write(html_content)
    
    def _format_test_results_html(self, report_data):
        """Format test results as HTML."""
        html = "<table><tr><th>Test Suite</th><th>Total</th><th>Passed</th><th>Failed</th><th>Success Rate</th></tr>"
        
        for test_type in ["unit_tests", "integration_tests"]:
            data = report_data.get(test_type, {})
            if data.get("status") == "completed":
                html += f"""
                <tr>
                    <td>{test_type.replace('_', ' ').title()}</td>
                    <td>{data.get('total_tests', 0)}</td>
                    <td class="status-passed">{data.get('passed', 0)}</td>
                    <td class="status-failed">{data.get('failed', 0)}</td>
                    <td>{data.get('success_rate', 0)}%</td>
                </tr>
                """
        
        html += "</table>"
        return html
    
    def _format_coverage_html(self, coverage_data):
        """Format coverage data as HTML."""
        if coverage_data.get("status") != "available":
            return "<p>Coverage data not available</p>"
        
        overall = coverage_data.get("overall_coverage", 0)
        target = coverage_data.get("target_coverage", 90)
        
        html = f"""
        <div class="progress-bar">
            <div class="progress-fill" style="width: {overall}%"></div>
        </div>
        <p><strong>Overall Coverage:</strong> {overall}% (Target: {target}%)</p>
        """
        
        packages = coverage_data.get("packages", [])
        if packages:
            html += "<h3>Package Coverage</h3><table><tr><th>Package</th><th>Line Coverage</th><th>Lines Covered</th></tr>"
            for package in packages:
                html += f"""
                <tr>
                    <td>{package['name']}</td>
                    <td>{package['line_rate']:.1f}%</td>
                    <td>{package['lines_covered']}/{package['lines_valid']}</td>
                </tr>
                """
            html += "</table>"
        
        return html
    
    def _format_performance_html(self, performance_data):
        """Format performance data as HTML."""
        if performance_data.get("status") != "completed":
            return "<p>Performance tests not run or data not available</p>"
        
        return f"""
        <p><strong>Average Response Time:</strong> {performance_data.get('avg_response_time', 'N/A')}</p>
        <p><strong>95th Percentile:</strong> {performance_data.get('p95_response_time', 'N/A')}</p>
        <p><strong>Requests per Second:</strong> {performance_data.get('requests_per_second', 'N/A')}</p>
        <p><strong>Error Rate:</strong> {performance_data.get('error_rate', 'N/A')}</p>
        """
    
    def _format_security_html(self, security_data):
        """Format security data as HTML."""
        if not security_data:
            return "<p>Security scans not run</p>"
        
        html = ""
        
        if "bandit" in security_data:
            bandit = security_data["bandit"]
            if bandit.get("status") == "completed":
                html += f"""
                <h3>Bandit Security Scan</h3>
                <p><strong>High Severity:</strong> {bandit.get('high_severity', 0)}</p>
                <p><strong>Medium Severity:</strong> {bandit.get('medium_severity', 0)}</p>
                <p><strong>Low Severity:</strong> {bandit.get('low_severity', 0)}</p>
                <p><strong>Total Issues:</strong> {bandit.get('total_issues', 0)}</p>
                """
        
        if "safety" in security_data:
            safety = security_data["safety"]
            if safety.get("status") == "completed":
                html += f"""
                <h3>Safety Dependency Check</h3>
                <p><strong>Known Vulnerabilities:</strong> {safety.get('vulnerabilities', 0)}</p>
                """
        
        return html or "<p>Security scan data not available</p>"
    
    def _format_quality_html(self, quality_data):
        """Format quality data as HTML."""
        if not quality_data:
            return "<p>Code quality checks not run</p>"
        
        html = ""
        
        if "flake8" in quality_data:
            flake8 = quality_data["flake8"]
            if flake8.get("status") == "completed":
                html += f"""
                <h3>Flake8 Code Quality</h3>
                <p><strong>Total Violations:</strong> {flake8.get('total_violations', 0)}</p>
                """
        
        return html or "<p>Code quality data not available</p>"
    
    def _format_recommendations_html(self, recommendations):
        """Format recommendations as HTML."""
        if not recommendations:
            return "<p>No specific recommendations at this time.</p>"
        
        html = ""
        for rec in recommendations:
            priority_class = f"priority-{rec.get('priority', 'low')}"
            html += f"""
            <div class="recommendation {priority_class}">
                <h4>{rec.get('title', 'Recommendation')}</h4>
                <p><strong>Category:</strong> {rec.get('category', 'General')}</p>
                <p><strong>Priority:</strong> {rec.get('priority', 'Low').title()}</p>
                <p>{rec.get('description', 'No description provided.')}</p>
            </div>
            """
        
        return html
    
    def _generate_json_report(self, report_data):
        """Generate JSON test report."""
        with open(self.reports_dir / "test-report.json", 'w') as f:
            json.dump(report_data, f, indent=2)
    
    def _generate_executive_summary(self, report_data):
        """Generate executive summary."""
        summary_text = f"""
# SongNodes Test Report Executive Summary

**Generated:** {report_data['generated_at']}

## Overall Status
- **Test Coverage:** {report_data.get('coverage', {}).get('overall_coverage', 0):.1f}%
- **Tests Run:** {report_data.get('unit_tests', {}).get('total_tests', 0) + report_data.get('integration_tests', {}).get('total_tests', 0)}
- **Success Rate:** {((report_data.get('unit_tests', {}).get('passed', 0) + report_data.get('integration_tests', {}).get('passed', 0)) / max(1, report_data.get('unit_tests', {}).get('total_tests', 0) + report_data.get('integration_tests', {}).get('total_tests', 0))) * 100:.1f}%

## Key Findings
- Unit tests: {report_data.get('unit_tests', {}).get('status', 'not run')}
- Integration tests: {report_data.get('integration_tests', {}).get('status', 'not run')}
- Performance tests: {report_data.get('performance_tests', {}).get('status', 'not run')}
- Security scans: {len(report_data.get('security', {}))} checks completed

## Recommendations
{len(report_data.get('recommendations', []))} recommendations generated for improvement.

See full report: test-report.html
        """
        
        with open(self.reports_dir / "executive-summary.md", 'w') as f:
            f.write(summary_text.strip())


def main():
    """Main function to generate test reports."""
    generator = TestReportGenerator()
    report_data = generator.generate_comprehensive_report()
    
    # Print summary to console
    print("\n" + "="*60)
    print("TEST REPORT SUMMARY")
    print("="*60)
    
    unit_tests = report_data.get("unit_tests", {})
    integration_tests = report_data.get("integration_tests", {})
    coverage = report_data.get("coverage", {})
    
    total_tests = unit_tests.get("total_tests", 0) + integration_tests.get("total_tests", 0)
    total_passed = unit_tests.get("passed", 0) + integration_tests.get("passed", 0)
    success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {total_passed}")
    print(f"Success Rate: {success_rate:.1f}%")
    print(f"Coverage: {coverage.get('overall_coverage', 0):.1f}%")
    print(f"Recommendations: {len(report_data.get('recommendations', []))}")
    
    print(f"\nDetailed reports available in: {generator.reports_dir}")
    print("- test-report.html (comprehensive)")
    print("- test-report.json (machine readable)")
    print("- executive-summary.md (summary)")


if __name__ == "__main__":
    main()