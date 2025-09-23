import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash2, Save, X, MapPin, Phone, Mail, Package, DollarSign, Users, Activity } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Switch } from './components/ui/switch';
import { Label } from './components/ui/label';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

function AdminPanel() {
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [isAddingPharmacy, setIsAddingPharmacy] = useState(false);
  const [isEditingPharmacy, setIsEditingPharmacy] = useState(false);
  const [newPharmacy, setNewPharmacy] = useState({
    name: '',
    phone: '',
    email: '',
    location: {
      lat: 36.7538,
      lng: 3.0588,
      address: '',
      wilaya: 'Alger',
      commune: 'Alger Centre',
      quartier: ''
    },
    is_guard: false,
    subscription_active: true,
    stock: []
  });
  const [newStockItem, setNewStockItem] = useState({
    medication_name: '',
    quantity: 0,
    price: 0,
    available: true
  });
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [stats, setStats] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const wilayas = ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Djelfa', 'Sétif'];
  const communes = {
    'Alger': ['Alger Centre', 'Hydra', 'El Mouradia', 'Bab El Oued', 'Hussein Dey'],
    'Oran': ['Oran', 'Es Sénia', 'Bir El Djir', 'Sidi Bel Abbès'],
    'Constantine': ['Constantine', 'El Khroub', 'Ain Smara', 'Hamma Bouziane']
  };

  useEffect(() => {
    fetchPharmacies();
    fetchStats();
  }, []);

  const fetchPharmacies = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/pharmacies`);
      setPharmacies(response.data);
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Set default stats if endpoint doesn't exist yet
      setStats({
        total_pharmacies: pharmacies.length,
        active_subscriptions: pharmacies.filter(p => p.subscription_active).length,
        total_medications: pharmacies.reduce((acc, p) => acc + (p.stock?.length || 0), 0),
        guard_pharmacies: pharmacies.filter(p => p.is_guard).length
      });
    }
  };

  const handleAddPharmacy = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/admin/pharmacies`, newPharmacy);
      setPharmacies([...pharmacies, response.data]);
      setNewPharmacy({
        name: '',
        phone: '',
        email: '',
        location: {
          lat: 36.7538,
          lng: 3.0588,
          address: '',
          wilaya: 'Alger',
          commune: 'Alger Centre',
          quartier: ''
        },
        is_guard: false,
        subscription_active: true,
        stock: []
      });
      setIsAddingPharmacy(false);
      fetchStats();
    } catch (error) {
      console.error('Error adding pharmacy:', error);
      alert('Erreur lors de l\'ajout de la pharmacie');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePharmacy = async (pharmacyId, updates) => {
    try {
      setIsLoading(true);
      const response = await axios.put(`${API_BASE_URL}/api/admin/pharmacies/${pharmacyId}`, updates);
      setPharmacies(pharmacies.map(p => p.id === pharmacyId ? response.data : p));
      if (selectedPharmacy && selectedPharmacy.id === pharmacyId) {
        setSelectedPharmacy(response.data);
      }
      setIsEditingPharmacy(false);
      fetchStats();
    } catch (error) {
      console.error('Error updating pharmacy:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePharmacy = async (pharmacyId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette pharmacie ?')) return;
    
    try {
      setIsLoading(true);
      await axios.delete(`${API_BASE_URL}/api/admin/pharmacies/${pharmacyId}`);
      setPharmacies(pharmacies.filter(p => p.id !== pharmacyId));
      if (selectedPharmacy && selectedPharmacy.id === pharmacyId) {
        setSelectedPharmacy(null);
      }
      fetchStats();
    } catch (error) {
      console.error('Error deleting pharmacy:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStock = async () => {
    if (!selectedPharmacy) return;
    
    try {
      setIsLoading(true);
      const updatedStock = [...(selectedPharmacy.stock || []), newStockItem];
      await handleUpdatePharmacy(selectedPharmacy.id, { stock: updatedStock });
      setNewStockItem({
        medication_name: '',
        quantity: 0,
        price: 0,
        available: true
      });
      setIsAddingStock(false);
    } catch (error) {
      console.error('Error adding stock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStock = async (stockIndex) => {
    if (!selectedPharmacy) return;
    
    const updatedStock = selectedPharmacy.stock.filter((_, index) => index !== stockIndex);
    await handleUpdatePharmacy(selectedPharmacy.id, { stock: updatedStock });
  };

  const handleUpdateStock = async (stockIndex, updates) => {
    if (!selectedPharmacy) return;
    
    const updatedStock = selectedPharmacy.stock.map((item, index) => 
      index === stockIndex ? { ...item, ...updates } : item
    );
    await handleUpdatePharmacy(selectedPharmacy.id, { stock: updatedStock });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panneau d'Administration</h1>
                <p className="text-sm text-gray-600">Gestion des pharmacies et stocks</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                Retour au site
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="pharmacies">Pharmacies</TabsTrigger>
            <TabsTrigger value="stocks">Gestion des Stocks</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pharmacies</CardTitle>
                  <MapPin className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_pharmacies || pharmacies.length}</div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Abonnements Actifs</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.active_subscriptions || pharmacies.filter(p => p.subscription_active).length}</div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Médicaments en Stock</CardTitle>
                  <Package className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.total_medications || pharmacies.reduce((acc, p) => acc + (p.stock?.length || 0), 0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pharmacies de Garde</CardTitle>
                  <Activity className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.guard_pharmacies || pharmacies.filter(p => p.is_guard).length}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle>Pharmacies Récentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pharmacies.slice(0, 5).map(pharmacy => (
                    <div key={pharmacy.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">{pharmacy.name}</h3>
                        <p className="text-sm text-gray-600">{pharmacy.location.address}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {pharmacy.is_guard && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">Garde</Badge>
                        )}
                        <Badge variant={pharmacy.subscription_active ? "secondary" : "destructive"}>
                          {pharmacy.subscription_active ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pharmacies Management */}
          <TabsContent value="pharmacies" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestion des Pharmacies</h2>
              <Button 
                onClick={() => setIsAddingPharmacy(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter Pharmacie
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader>
                  <CardTitle>Liste des Pharmacies ({pharmacies.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {isLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                    </div>
                  ) : (
                    pharmacies.map(pharmacy => (
                      <div
                        key={pharmacy.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedPharmacy?.id === pharmacy.id
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-emerald-300'
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
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">Garde</Badge>
                            )}
                            <Badge variant={pharmacy.subscription_active ? "secondary" : "destructive"}>
                              {pharmacy.subscription_active ? "Actif" : "Inactif"}
                            </Badge>
                            <div className="flex gap-1 mt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPharmacy(pharmacy);
                                  setIsEditingPharmacy(true);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePharmacy(pharmacy.id);
                                }}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {selectedPharmacy && (
                <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                  <CardHeader>
                    <CardTitle>Détails - {selectedPharmacy.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="font-medium">Informations</Label>
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span>{selectedPharmacy.phone}</span>
                        </div>
                        {selectedPharmacy.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-500" />
                            <span>{selectedPharmacy.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span>{selectedPharmacy.location.address}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="font-medium">Stock ({selectedPharmacy.stock?.length || 0} articles)</Label>
                      <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
                        {selectedPharmacy.stock?.length > 0 ? (
                          selectedPharmacy.stock.map((item, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <div>
                                <span className="font-medium">{item.medication_name}</span>
                                <div className="text-xs text-gray-600">
                                  {item.quantity} unités • {item.price} DA
                                </div>
                              </div>
                              <Badge variant={item.available ? "secondary" : "destructive"}>
                                {item.available ? "Disponible" : "Rupture"}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">Aucun stock</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Stock Management */}
          <TabsContent value="stocks" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestion des Stocks</h2>
              {selectedPharmacy && (
                <Button 
                  onClick={() => setIsAddingStock(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter Médicament
                </Button>
              )}
            </div>

            {!selectedPharmacy ? (
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardContent className="text-center py-8">
                  <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Sélectionnez une pharmacie</h3>
                  <p className="text-gray-500">Choisissez une pharmacie dans l'onglet "Pharmacies" pour gérer son stock</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader>
                  <CardTitle>Stock - {selectedPharmacy.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedPharmacy.stock?.length > 0 ? (
                      selectedPharmacy.stock.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1 grid grid-cols-3 gap-4">
                            <div>
                              <Label className="text-sm text-gray-600">Médicament</Label>
                              <Input
                                value={item.medication_name}
                                onChange={(e) => handleUpdateStock(index, { medication_name: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-sm text-gray-600">Quantité</Label>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleUpdateStock(index, { quantity: parseInt(e.target.value) || 0 })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-sm text-gray-600">Prix (DA)</Label>
                              <Input
                                type="number"
                                value={item.price}
                                onChange={(e) => handleUpdateStock(index, { price: parseFloat(e.target.value) || 0 })}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={item.available}
                                onCheckedChange={(checked) => handleUpdateStock(index, { available: checked })}
                              />
                              <Label>Disponible</Label>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteStock(index)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500">Aucun médicament en stock</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle>Paramètres Système</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Fonctionnalités de configuration à venir...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Pharmacy Dialog */}
      <Dialog open={isAddingPharmacy} onOpenChange={setIsAddingPharmacy}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter une Nouvelle Pharmacie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom de la pharmacie *</Label>
                <Input
                  value={newPharmacy.name}
                  onChange={(e) => setNewPharmacy({...newPharmacy, name: e.target.value})}
                  placeholder="Pharmacie..."
                />
              </div>
              <div>
                <Label>Téléphone *</Label>
                <Input
                  value={newPharmacy.phone}
                  onChange={(e) => setNewPharmacy({...newPharmacy, phone: e.target.value})}
                  placeholder="021-XXX-XXX"
                />
              </div>
            </div>
            
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newPharmacy.email}
                onChange={(e) => setNewPharmacy({...newPharmacy, email: e.target.value})}
                placeholder="pharmacie@example.com"
              />
            </div>

            <div>
              <Label>Adresse *</Label>
              <Input
                value={newPharmacy.location.address}
                onChange={(e) => setNewPharmacy({
                  ...newPharmacy, 
                  location: {...newPharmacy.location, address: e.target.value}
                })}
                placeholder="Adresse complète"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Wilaya *</Label>
                <Select 
                  value={newPharmacy.location.wilaya} 
                  onValueChange={(value) => setNewPharmacy({
                    ...newPharmacy,
                    location: {...newPharmacy.location, wilaya: value, commune: communes[value]?.[0] || ''}
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {wilayas.map(wilaya => (
                      <SelectItem key={wilaya} value={wilaya}>{wilaya}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Commune *</Label>
                <Select 
                  value={newPharmacy.location.commune}
                  onValueChange={(value) => setNewPharmacy({
                    ...newPharmacy,
                    location: {...newPharmacy.location, commune: value}
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(communes[newPharmacy.location.wilaya] || []).map(commune => (
                      <SelectItem key={commune} value={commune}>{commune}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={newPharmacy.location.lat}
                  onChange={(e) => setNewPharmacy({
                    ...newPharmacy,
                    location: {...newPharmacy.location, lat: parseFloat(e.target.value) || 0}
                  })}
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={newPharmacy.location.lng}
                  onChange={(e) => setNewPharmacy({
                    ...newPharmacy,
                    location: {...newPharmacy.location, lng: parseFloat(e.target.value) || 0}
                  })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newPharmacy.is_guard}
                  onCheckedChange={(checked) => setNewPharmacy({...newPharmacy, is_guard: checked})}
                />
                <Label>Pharmacie de garde</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newPharmacy.subscription_active}
                  onCheckedChange={(checked) => setNewPharmacy({...newPharmacy, subscription_active: checked})}
                />
                <Label>Abonnement actif</Label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleAddPharmacy}
                disabled={!newPharmacy.name || !newPharmacy.phone || !newPharmacy.location.address}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
              <Button 
                onClick={() => setIsAddingPharmacy(false)}
                variant="outline"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={isAddingStock} onOpenChange={setIsAddingStock}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un Médicament</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom du médicament *</Label>
              <Input
                value={newStockItem.medication_name}
                onChange={(e) => setNewStockItem({...newStockItem, medication_name: e.target.value})}
                placeholder="Ex: Paracétamol 500mg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantité *</Label>
                <Input
                  type="number"
                  value={newStockItem.quantity}
                  onChange={(e) => setNewStockItem({...newStockItem, quantity: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Prix (DA) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newStockItem.price}
                  onChange={(e) => setNewStockItem({...newStockItem, price: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newStockItem.available}
                onCheckedChange={(checked) => setNewStockItem({...newStockItem, available: checked})}
              />
              <Label>Disponible</Label>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleAddStock}
                disabled={!newStockItem.medication_name}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Ajouter
              </Button>
              <Button 
                onClick={() => setIsAddingStock(false)}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminPanel;