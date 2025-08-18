import requests
import sys
import json
from datetime import datetime

class PharmacyAPITester:
    def __init__(self, base_url="https://prescriptify.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "status": "PASS" if success else "FAIL",
            "details": details
        }
        self.test_results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {name}: {result['status']}")
        if details:
            print(f"   Details: {details}")

    def test_root_endpoint(self):
        """Test root API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Message: {data.get('message', 'N/A')}"
            self.log_test("Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Error: {str(e)}")
            return False

    def test_get_all_pharmacies(self):
        """Test getting all pharmacies"""
        try:
            response = requests.get(f"{self.base_url}/api/pharmacies", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                pharmacies = response.json()
                details += f", Found {len(pharmacies)} pharmacies"
                
                # Verify expected pharmacies exist
                pharmacy_names = [p.get('name', '') for p in pharmacies]
                expected_names = ["Pharmacie Central Alger", "Pharmacie Hydra", "Pharmacie Oran Centre"]
                
                for expected in expected_names:
                    if expected in pharmacy_names:
                        details += f", ✓ {expected}"
                    else:
                        details += f", ✗ Missing {expected}"
                        success = False
                        
            self.log_test("Get All Pharmacies", success, details)
            return success, response.json() if success else []
        except Exception as e:
            self.log_test("Get All Pharmacies", False, f"Error: {str(e)}")
            return False, []

    def test_filter_by_wilaya(self):
        """Test filtering pharmacies by wilaya"""
        try:
            response = requests.get(f"{self.base_url}/api/pharmacies?wilaya=Alger", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                pharmacies = response.json()
                alger_count = len([p for p in pharmacies if p.get('location', {}).get('wilaya') == 'Alger'])
                details += f", Found {alger_count} pharmacies in Alger"
                
                # Should find 2 pharmacies in Alger
                if alger_count >= 2:
                    details += " (Expected 2+)"
                else:
                    success = False
                    details += " (Expected 2+, filtering may not work)"
                    
            self.log_test("Filter by Wilaya (Alger)", success, details)
            return success
        except Exception as e:
            self.log_test("Filter by Wilaya (Alger)", False, f"Error: {str(e)}")
            return False

    def test_filter_by_commune(self):
        """Test filtering pharmacies by commune"""
        try:
            response = requests.get(f"{self.base_url}/api/pharmacies?wilaya=Alger&commune=Hydra", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                pharmacies = response.json()
                hydra_count = len([p for p in pharmacies if p.get('location', {}).get('commune') == 'Hydra'])
                details += f", Found {hydra_count} pharmacies in Hydra"
                
                # Should find 1 pharmacy in Hydra
                if hydra_count >= 1:
                    details += " (Expected 1+)"
                else:
                    success = False
                    details += " (Expected 1+, filtering may not work)"
                    
            self.log_test("Filter by Commune (Hydra)", success, details)
            return success
        except Exception as e:
            self.log_test("Filter by Commune (Hydra)", False, f"Error: {str(e)}")
            return False

    def test_medication_search(self):
        """Test medication search"""
        try:
            response = requests.get(f"{self.base_url}/api/pharmacies?medication=Paracétamol", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                pharmacies = response.json()
                details += f", Found {len(pharmacies)} pharmacies with Paracétamol"
                
                # Check if pharmacies have Paracétamol in stock
                paracetamol_count = 0
                for pharmacy in pharmacies:
                    for stock_item in pharmacy.get('stock', []):
                        if 'paracétamol' in stock_item.get('medication_name', '').lower():
                            paracetamol_count += 1
                            break
                
                details += f", {paracetamol_count} have it in stock"
                if paracetamol_count == 0:
                    success = False
                    details += " (Expected at least 1)"
                    
            self.log_test("Medication Search (Paracétamol)", success, details)
            return success
        except Exception as e:
            self.log_test("Medication Search (Paracétamol)", False, f"Error: {str(e)}")
            return False

    def test_get_specific_pharmacy(self, pharmacy_id):
        """Test getting specific pharmacy details"""
        try:
            response = requests.get(f"{self.base_url}/api/pharmacies/{pharmacy_id}", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                pharmacy = response.json()
                details += f", Pharmacy: {pharmacy.get('name', 'Unknown')}"
                details += f", Stock items: {len(pharmacy.get('stock', []))}"
                
            self.log_test(f"Get Specific Pharmacy ({pharmacy_id[:8]}...)", success, details)
            return success, response.json() if success else None
        except Exception as e:
            self.log_test(f"Get Specific Pharmacy ({pharmacy_id[:8]}...)", False, f"Error: {str(e)}")
            return False, None

    def test_search_medication_endpoint(self):
        """Test the search-medication POST endpoint"""
        try:
            payload = {
                "medication_name": "Paracétamol",
                "wilaya": "Alger"
            }
            response = requests.post(f"{self.base_url}/api/search-medication", json=payload, timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                total_found = data.get('total_found', 0)
                details += f", Total found: {total_found}"
                
                if total_found > 0:
                    details += f", Results: {len(data.get('results', []))}"
                else:
                    success = False
                    details += " (Expected at least 1 result)"
                    
            self.log_test("Search Medication Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("Search Medication Endpoint", False, f"Error: {str(e)}")
            return False

    def test_chat_endpoint(self, pharmacy_id):
        """Test chat endpoint with pharmacy"""
        try:
            params = {
                "message": "Avez-vous du Paracétamol disponible?",
                "user_id": "test_user_123"
            }
            response = requests.post(f"{self.base_url}/api/chat/{pharmacy_id}", params=params, timeout=15)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                chat_response = data.get('response', '')
                details += f", Response length: {len(chat_response)} chars"
                
                # Check if response contains expected content
                if 'paracétamol' in chat_response.lower() or 'disponible' in chat_response.lower() or 'désolé' in chat_response.lower():
                    details += ", Response seems relevant"
                else:
                    details += ", Response may not be relevant"
                    
            self.log_test(f"Chat Endpoint ({pharmacy_id[:8]}...)", success, details)
            return success
        except Exception as e:
            self.log_test(f"Chat Endpoint ({pharmacy_id[:8]}...)", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🧪 Starting Pharmacy Platform Backend API Tests")
        print("=" * 60)
        
        # Test basic connectivity
        if not self.test_root_endpoint():
            print("❌ Root endpoint failed - stopping tests")
            return False
            
        # Test pharmacy endpoints
        success, pharmacies = self.test_get_all_pharmacies()
        if not success or not pharmacies:
            print("❌ Cannot get pharmacies - stopping tests")
            return False
            
        # Test filtering
        self.test_filter_by_wilaya()
        self.test_filter_by_commune()
        self.test_medication_search()
        
        # Test search endpoint
        self.test_search_medication_endpoint()
        
        # Test specific pharmacy and chat (using first pharmacy)
        if pharmacies:
            first_pharmacy = pharmacies[0]
            pharmacy_id = first_pharmacy.get('id')
            
            if pharmacy_id:
                self.test_get_specific_pharmacy(pharmacy_id)
                self.test_chat_endpoint(pharmacy_id)
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check details above.")
            return False

def main():
    tester = PharmacyAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())