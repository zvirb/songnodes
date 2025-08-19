#!/usr/bin/env python3
"""
Validation script for SongNodes test automation framework.
"""

import sys
import os
from pathlib import Path
import subprocess
import json


class TestFrameworkValidator:
    """Validate the test automation framework setup."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.tests_dir = self.project_root / "tests"
        self.validation_results = {
            "framework_structure": False,
            "dependencies": False,
            "configuration": False,
            "test_files": False,
            "ci_cd": False,
            "documentation": False
        }
    
    def validate_framework_structure(self):
        """Validate test framework directory structure."""
        print("🔍 Validating test framework structure...")
        
        required_dirs = [
            "tests/unit",
            "tests/integration", 
            "tests/performance",
            "tests/e2e",
            "tests/fixtures",
            "tests/utils"
        ]
        
        required_files = [
            "tests/README.md",
            "tests/conftest.py",
            "tests/requirements.txt",
            "Makefile",
            "docker-compose.test.yml"
        ]
        
        missing_dirs = []
        missing_files = []
        
        for dir_path in required_dirs:
            if not (self.project_root / dir_path).exists():
                missing_dirs.append(dir_path)
        
        for file_path in required_files:
            if not (self.project_root / file_path).exists():
                missing_files.append(file_path)
        
        if missing_dirs:
            print(f"❌ Missing directories: {', '.join(missing_dirs)}")
        
        if missing_files:
            print(f"❌ Missing files: {', '.join(missing_files)}")
        
        if not missing_dirs and not missing_files:
            print("✅ Test framework structure is complete")
            self.validation_results["framework_structure"] = True
        
        return not missing_dirs and not missing_files
    
    def validate_dependencies(self):
        """Validate test dependencies are properly defined."""
        print("🔍 Validating test dependencies...")
        
        requirements_file = self.tests_dir / "requirements.txt"
        
        if not requirements_file.exists():
            print("❌ tests/requirements.txt not found")
            return False
        
        with open(requirements_file, 'r') as f:
            content = f.read()
        
        required_packages = [
            "pytest",
            "pytest-asyncio",
            "pytest-cov",
            "httpx",
            "locust",
            "playwright",
            "factory-boy"
        ]
        
        missing_packages = []
        for package in required_packages:
            if package not in content:
                missing_packages.append(package)
        
        if missing_packages:
            print(f"❌ Missing packages in requirements.txt: {', '.join(missing_packages)}")
            return False
        
        print("✅ Test dependencies are properly defined")
        self.validation_results["dependencies"] = True
        return True
    
    def validate_configuration(self):
        """Validate test configuration files."""
        print("🔍 Validating test configuration...")
        
        config_files = [
            (self.project_root / "scripts" / "pytest.ini", "pytest.ini"),
            (self.project_root / ".coveragerc", ".coveragerc"),
            (self.tests_dir / "conftest.py", "conftest.py")
        ]
        
        missing_configs = []
        for file_path, name in config_files:
            if not file_path.exists():
                missing_configs.append(name)
        
        if missing_configs:
            print(f"❌ Missing configuration files: {', '.join(missing_configs)}")
            return False
        
        print("✅ Test configuration files are present")
        self.validation_results["configuration"] = True
        return True
    
    def validate_test_files(self):
        """Validate test files are present and properly structured."""
        print("🔍 Validating test files...")
        
        test_categories = {
            "unit": ["scrapers", "services"],
            "integration": ["api_endpoints"],
            "performance": ["load_tests"],
            "e2e": ["complete_workflows"],
        }
        
        missing_tests = []
        for category, test_types in test_categories.items():
            category_dir = self.tests_dir / category
            
            if not category_dir.exists():
                missing_tests.append(f"{category} directory")
                continue
            
            for test_type in test_types:
                test_files = list(category_dir.rglob(f"*{test_type}*.py"))
                if not test_files:
                    missing_tests.append(f"{category}/{test_type} tests")
        
        if missing_tests:
            print(f"❌ Missing test files: {', '.join(missing_tests)}")
            return False
        
        # Count total test files
        test_files = list(self.tests_dir.rglob("test_*.py"))
        print(f"✅ Found {len(test_files)} test files")
        
        self.validation_results["test_files"] = True
        return True
    
    def validate_ci_cd(self):
        """Validate CI/CD configuration."""
        print("🔍 Validating CI/CD configuration...")
        
        github_workflow = self.project_root / ".github" / "workflows" / "test-automation.yml"
        makefile = self.project_root / "Makefile"
        
        if not github_workflow.exists():
            print("❌ GitHub Actions workflow not found")
            return False
        
        if not makefile.exists():
            print("❌ Makefile not found")
            return False
        
        # Check Makefile has test targets
        with open(makefile, 'r') as f:
            makefile_content = f.read()
        
        required_targets = ["test", "test-unit", "test-integration", "test-performance", "test-coverage"]
        missing_targets = []
        
        for target in required_targets:
            if f"{target}:" not in makefile_content:
                missing_targets.append(target)
        
        if missing_targets:
            print(f"❌ Missing Makefile targets: {', '.join(missing_targets)}")
            return False
        
        print("✅ CI/CD configuration is complete")
        self.validation_results["ci_cd"] = True
        return True
    
    def validate_documentation(self):
        """Validate test documentation."""
        print("🔍 Validating test documentation...")
        
        readme = self.tests_dir / "README.md"
        
        if not readme.exists():
            print("❌ tests/README.md not found")
            return False
        
        with open(readme, 'r') as f:
            content = f.read()
        
        required_sections = [
            "Test Coverage Goals",
            "Test Architecture", 
            "Quick Start",
            "Quality Metrics"
        ]
        
        missing_sections = []
        for section in required_sections:
            if section not in content:
                missing_sections.append(section)
        
        if missing_sections:
            print(f"❌ Missing documentation sections: {', '.join(missing_sections)}")
            return False
        
        print("✅ Test documentation is complete")
        self.validation_results["documentation"] = True
        return True
    
    def validate_test_execution(self):
        """Test that tests can be executed."""
        print("🔍 Validating test execution capability...")
        
        try:
            # Try dry run of pytest
            result = subprocess.run([
                sys.executable, "-m", "pytest", "--collect-only", 
                str(self.tests_dir), "-q"
            ], capture_output=True, text=True, cwd=self.project_root)
            
            if result.returncode == 0:
                print("✅ Tests can be collected and executed")
                return True
            else:
                print(f"❌ Test collection failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing execution: {e}")
            return False
    
    def generate_validation_report(self):
        """Generate validation report."""
        print("\n" + "="*60)
        print("TEST FRAMEWORK VALIDATION REPORT")
        print("="*60)
        
        total_checks = len(self.validation_results)
        passed_checks = sum(self.validation_results.values())
        
        print(f"Overall Status: {passed_checks}/{total_checks} checks passed")
        print(f"Success Rate: {(passed_checks/total_checks)*100:.1f}%")
        print()
        
        for check, status in self.validation_results.items():
            status_icon = "✅" if status else "❌"
            print(f"{status_icon} {check.replace('_', ' ').title()}")
        
        print("\nTest Framework Components:")
        print(f"- Unit Tests: {len(list(self.tests_dir.glob('unit/**/*.py')))}")
        print(f"- Integration Tests: {len(list(self.tests_dir.glob('integration/**/*.py')))}")
        print(f"- Performance Tests: {len(list(self.tests_dir.glob('performance/**/*.py')))}")
        print(f"- E2E Tests: {len(list(self.tests_dir.glob('e2e/**/*.py')))}")
        print(f"- Fixtures: {len(list(self.tests_dir.glob('fixtures/**/*.py')))}")
        print(f"- Utilities: {len(list(self.tests_dir.glob('utils/**/*.py')))}")
        
        if passed_checks == total_checks:
            print("\n🎉 Test automation framework is fully validated!")
            return True
        else:
            print(f"\n⚠️  {total_checks - passed_checks} validation issues need to be addressed")
            return False
    
    def run_validation(self):
        """Run complete validation."""
        print("🚀 Starting SongNodes Test Framework Validation\n")
        
        validators = [
            self.validate_framework_structure,
            self.validate_dependencies,
            self.validate_configuration,
            self.validate_test_files,
            self.validate_ci_cd,
            self.validate_documentation
        ]
        
        for validator in validators:
            try:
                validator()
            except Exception as e:
                print(f"❌ Validation error: {e}")
            print()
        
        # Try test execution if framework structure is valid
        if self.validation_results["framework_structure"]:
            self.validate_test_execution()
            print()
        
        return self.generate_validation_report()


def main():
    """Main validation function."""
    validator = TestFrameworkValidator()
    success = validator.run_validation()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()