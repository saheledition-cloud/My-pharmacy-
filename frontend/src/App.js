import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, MapPin, Phone, Clock, MessageCircle, Upload, Camera, AlertCircle } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Alert, AlertDescription } from './components/ui/alert';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [pharmacies, setPharmacies] = useState([]);
  const [filteredPharmacies, setFilteredPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWilaya, setSelectedWilaya] = useState('');
  const [selectedCommune, setSelectedCommune] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [prescriptionFile, setPrescriptionFile] = useState(null);

  // Algeria locations data
  const wilayas = ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Djelfa', 'Sétif'];
  const communes = {
    'Alger': ['Alger Centre', 'Hydra', 'El Mouradia', 'Bab El Oued', 'Hussein Dey'],
    'Oran': ['Oran', 'Es Sénia', 'Bir El Djir', 'Sidi Bel Abbès'],
    'Constantine': ['Constantine', 'El Khroub', 'Ain Smara', 'Hamma Bouziane']
  };

  // Initialize map
  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [3.0588, 36.7538], // Algiers center
        zoom: 10
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Fetch pharmacies
  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (selectedWilaya) params.append('wilaya', selectedWilaya);
        if (selectedCommune) params.append('commune', selectedCommune);
        if (searchQuery) params.append('medication', searchQuery);

        const response = await axios.get(`${API_BASE_URL}/api/pharmacies?${params}`);
        setPharmacies(response.data);
        setFilteredPharmacies(response.data);
      } catch (error) {
        console.error('Error fetching pharmacies:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPharmacies();
  }, [selectedWilaya, selectedCommune, searchQuery]);

  // Update map markers
  useEffect(() => {
    if (map.current && filteredPharmacies.length > 0) {
      // Clear existing markers
      const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
      existingMarkers.forEach(marker => marker.remove());

      // Add new markers
      filteredPharmacies.forEach(pharmacy => {
        // Determine marker color based on availability
        const hasStock = pharmacy.stock && pharmacy.stock.some(item => item.available);
        const isGuard = pharmacy.is_guard;
        
        let markerColor = '#ef4444'; // Red for no stock
        if (hasStock) markerColor = '#10b981'; // Green for available
        if (isGuard) markerColor = '#3b82f6'; // Blue for guard pharmacy

        const marker = new mapboxgl.Marker({ color: markerColor })
          .setLngLat([pharmacy.location.lng, pharmacy.location.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div class="p-2">
                <h3 class="font-semibold">${pharmacy.name}</h3>
                <p class="text-sm text-gray-600">${pharmacy.location.address}</p>
                <p class="text-sm">${pharmacy.phone}</p>
                ${isGuard ? '<span class="text-blue-600 font-medium">🌙 Pharmacie de garde</span>' : ''}
              </div>
            `)
          )
          .addTo(map.current);

        // Add click event to select pharmacy
        marker.getElement().addEventListener('click', () => {
          setSelectedPharmacy(pharmacy);
        });
      });

      // Fit map to show all markers
      if (filteredPharmacies.length === 1) {
        map.current.flyTo({
          center: [filteredPharmacies[0].location.lng, filteredPharmacies[0].location.lat],
          zoom: 15
        });
      } else if (filteredPharmacies.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        filteredPharmacies.forEach(pharmacy => {
          bounds.extend([pharmacy.location.lng, pharmacy.location.lat]);
        });
        map.current.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [filteredPharmacies]);

  const handleChatSubmit = async () => {
    if (!chatMessage.trim() || !selectedPharmacy) return;

    try {
      setIsLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/chat/${selectedPharmacy.id}`, null, {
        params: {
          message: chatMessage,
          user_id: 'user_123' // In real app, this would be authenticated user ID
        }
      });
      setChatResponse(response.data.response);
      setChatMessage('');
    } catch (error) {
      console.error('Error sending chat message:', error);
      setChatResponse('Désolé, une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrescriptionUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setPrescriptionFile(file);
      // In a real app, you would process the file with OCR here
      console.log('Prescription file uploaded:', file.name);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PharmaCarte</h1>
                <p className="text-sm text-gray-600">Trouvez vos médicaments en Algérie</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                <Clock className="h-3 w-3 mr-1" />
                Temps réel
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search and Filters Panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-800">
                  <Search className="h-5 w-5" />
                  Recherche
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Input
                    placeholder="Nom du médicament..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border-emerald-200 focus:border-emerald-500"
                  />
                </div>
                
                <div>
                  <Select value={selectedWilaya} onValueChange={setSelectedWilaya}>
                    <SelectTrigger className="border-emerald-200">
                      <SelectValue placeholder="Sélectionner wilaya" />
                    </SelectTrigger>
                    <SelectContent>
                      {wilayas.map(wilaya => (
                        <SelectItem key={wilaya} value={wilaya}>{wilaya}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedWilaya && communes[selectedWilaya] && (
                  <div>
                    <Select value={selectedCommune} onValueChange={setSelectedCommune}>
                      <SelectTrigger className="border-emerald-200">
                        <SelectValue placeholder="Sélectionner commune" />
                      </SelectTrigger>
                      <SelectContent>
                        {communes[selectedWilaya].map(commune => (
                          <SelectItem key={commune} value={commune}>{commune}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setSelectedWilaya('');
                      setSelectedCommune('');
                      setSearchQuery('');
                    }}
                    variant="outline"
                    className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    Réinitialiser
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Prescription Upload */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-800">
                  <Camera className="h-5 w-5" />
                  Ordonnance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePrescriptionUpload}
                      className="hidden"
                      id="prescription-upload"
                    />
                    <Button 
                      asChild
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <label htmlFor="prescription-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Scanner ordonnance
                      </label>
                    </Button>
                  </label>
                  {prescriptionFile && (
                    <p className="text-sm text-green-600 font-medium">
                      ✓ {prescriptionFile.name} téléchargé
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pharmacy List */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-emerald-800">
                  Pharmacies ({filteredPharmacies.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                  </div>
                ) : filteredPharmacies.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucune pharmacie trouvée</p>
                ) : (
                  filteredPharmacies.map(pharmacy => (
                    <div
                      key={pharmacy.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        selectedPharmacy?.id === pharmacy.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-25'
                      }`}
                      onClick={() => setSelectedPharmacy(pharmacy)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{pharmacy.name}</h3>
                          <p className="text-sm text-gray-600">{pharmacy.location.address}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{pharmacy.phone}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {pharmacy.is_guard && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                              🌙 Garde
                            </Badge>
                          )}
                          <div className={`w-3 h-3 rounded-full ${
                            pharmacy.stock?.some(item => item.available) ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Map and Details */}
          <div className="lg:col-span-2 space-y-4">
            {/* Map */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-0">
                <div ref={mapContainer} className="h-96 w-full rounded-lg" />
              </CardContent>
            </Card>

            {/* Selected Pharmacy Details */}
            {selectedPharmacy && (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-emerald-800">{selectedPharmacy.name}</span>
                    {selectedPharmacy.is_guard && (
                      <Badge className="bg-blue-100 text-blue-800">
                        🌙 Pharmacie de garde
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="stock" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="stock">Stock disponible</TabsTrigger>
                      <TabsTrigger value="chat">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Chat IA
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="stock" className="space-y-3">
                      <div className="grid gap-2 max-h-48 overflow-y-auto">
                        {selectedPharmacy.stock?.length > 0 ? (
                          selectedPharmacy.stock.map((item, index) => (
                            <div
                              key={index}
                              className={`flex justify-between items-center p-2 rounded border ${
                                item.available ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                              }`}
                            >
                              <div>
                                <span className="font-medium">{item.medication_name}</span>
                                <div className="text-sm text-gray-600">
                                  {item.quantity} unités • {item.price} DA
                                </div>
                              </div>
                              <Badge variant={item.available ? "secondary" : "destructive"}>
                                {item.available ? "Disponible" : "Rupture"}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-center py-4">Aucun stock disponible</p>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="chat" className="space-y-3">
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Posez votre question au pharmacien IA..."
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          className="min-h-20 border-emerald-200"
                        />
                        <Button 
                          onClick={handleChatSubmit}
                          disabled={isLoading || !chatMessage.trim()}
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                          {isLoading ? 'Envoi...' : 'Envoyer'}
                        </Button>
                        
                        {chatResponse && (
                          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <h4 className="font-semibold text-emerald-800 mb-2">Réponse du pharmacien IA:</h4>
                            <p className="text-gray-700 whitespace-pre-wrap">{chatResponse}</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="fixed bottom-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border">
        <h4 className="font-semibold text-gray-800 mb-2">Légende</h4>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Médicament disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Rupture de stock</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>🌙 Pharmacie de garde</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;