import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Plus, Edit, Trash2, Save, X, Upload, FileSpreadsheet, 
  Package, DollarSign, Users, Activity, AlertTriangle,
  Eye, Download, LogOut, User
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Textarea } from './components/ui/textarea';
import { Switch } from './components/ui/switch';
import { Label } from './components/ui/label';
import { Alert, AlertDescription } from './components/ui/alert';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

function PharmacyDashboard() {
  const [user, setUser] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [stats, setStats] = useState({});
  const [stock, setStock] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [newStockItem, setNewStockItem] = useState({
    medication_name: '',
    quantity: 0,
    price: 0,
    available: true
  });
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [editingStockIndex, setEditingStockIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
      if (response.data.pharmacy) {
        setPharmacy(response.data.pharmacy);
        setStock(response.data.pharmacy.stock || []);
      }
    } catch (error) {
      console.error('Not authenticated:', error);
      window.location.href = '/login';
    }
  };

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/pharmacy/dashboard`, {
        withCredentials: true
      });
      
      setPharmacy(response.data.pharmacy);
      setStats(response.data.stats);
      setStock(response.data.pharmacy.stock || []);
      setPrescriptions(response.data.recent_prescriptions || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
        withCredentials: true
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleAddStock = async () => {
    if (!newStockItem.medication_name.trim()) return;
    
    try {
      setIsLoading(true);
      const updatedStock = [...stock, newStockItem];
      await updateStock(updatedStock);
      
      setNewStockItem({
        medication_name: '',
        quantity: 0,
        price: 0,
        available: true
      });
      setIsAddingStock(false);
    } catch (error) {
      console.error('Error adding stock:', error);
      alert('Erreur lors de l\'ajout du médicament');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStock = async (index, updates) => {
    const updatedStock = stock.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    );
    await updateStock(updatedStock);
  };

  const handleDeleteStock = async (index) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce médicament ?')) return;
    
    const updatedStock = stock.filter((_, i) => i !== index);
    await updateStock(updatedStock);
  };

  const updateStock = async (updatedStock) => {
    try {
      await axios.put(`${API_BASE_URL}/api/pharmacy/stock`, updatedStock, {
        withCredentials: true
      });
      setStock(updatedStock);
      loadDashboardData(); // Refresh stats
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)');
      return;
    }

    setUploadFile(file);
    setUploadProgress(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/pharmacy/stock/upload-excel`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true
      });

      alert(`Stock mis à jour avec succès ! ${response.data.items_count} articles importés.`);
      loadDashboardData(); // Refresh data
      setUploadFile(null);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Erreur lors de l\'importation du fichier Excel');
    } finally {
      setUploadProgress(false);
    }
  };

  const downloadExcelTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,medication_name,quantity,price,available\nParacétamol 500mg,50,120.0,true\nIbuprofène 400mg,30,250.0,true\nDoliprane 1000mg,25,180.0,false";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_stock.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user || !pharmacy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{pharmacy.name}</h1>
                <p className="text-sm text-gray-600">Tableau de bord pharmacie</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">{user.name}</span>
              </div>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                Site Client
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="stock">Gestion Stock</TabsTrigger>
            <TabsTrigger value="orders">Commandes</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
                  <Package className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_stock || 0}</div>
                  <p className="text-xs text-gray-600">articles référencés</p>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
                  <Activity className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.available_stock || 0}</div>
                  <p className="text-xs text-gray-600">en stock</p>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stock Faible</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.low_stock || 0}</div>
                  <p className="text-xs text-gray-600">&lt; 10 unités</p>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Commandes</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.recent_orders || 0}</div>
                  <p className="text-xs text-gray-600">cette semaine</p>
                </CardContent>
              </Card>
            </div>

            {/* Pharmacy Info */}
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle>Informations Pharmacie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-medium">Adresse</Label>
                    <p className="text-sm text-gray-600">{pharmacy.location.address}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Téléphone</Label>
                    <p className="text-sm text-gray-600">{pharmacy.phone}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Wilaya / Commune</Label>
                    <p className="text-sm text-gray-600">{pharmacy.location.wilaya} / {pharmacy.location.commune}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Statut</Label>
                    <div className="flex gap-2">
                      {pharmacy.is_guard && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">Garde</Badge>
                      )}
                      <Badge variant={pharmacy.subscription_active ? "secondary" : "destructive"}>
                        {pharmacy.subscription_active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Prescriptions */}
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle>Commandes Récentes</CardTitle>
              </CardHeader>
              <CardContent>
                {prescriptions.length > 0 ? (
                  <div className="space-y-3">
                    {prescriptions.map((prescription, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">Ordonnance #{prescription.id.slice(-8)}</h4>
                          <p className="text-sm text-gray-600">
                            {prescription.medications.join(', ')}
                          </p>
                        </div>
                        <Badge variant="secondary">{prescription.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Aucune commande récente</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stock Management */}
          <TabsContent value="stock" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Gestion du Stock</h2>
              <div className="flex gap-2">
                <Button 
                  onClick={downloadExcelTemplate}
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger modèle
                </Button>
                <Button 
                  onClick={() => setIsAddingStock(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter Article
                </Button>
              </div>
            </div>

            {/* Excel Upload */}
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Import Excel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Format Excel requis: medication_name, quantity, price, available (optionnel)
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex items-center gap-4">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploadProgress}
                      />
                      <Button 
                        asChild
                        disabled={uploadProgress}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        <span className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadProgress ? 'Importation...' : 'Sélectionner fichier Excel'}
                        </span>
                      </Button>
                    </label>
                  </div>
                  
                  {uploadFile && (
                    <div className="text-sm text-green-600">
                      ✓ Fichier sélectionné: {uploadFile.name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stock List */}
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle>Articles en Stock ({stock.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {stock.length > 0 ? (
                    stock.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        {editingStockIndex === index ? (
                          <div className="flex-1 grid grid-cols-3 gap-4">
                            <Input
                              value={item.medication_name}
                              onChange={(e) => handleUpdateStock(index, { medication_name: e.target.value })}
                              placeholder="Nom du médicament"
                            />
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleUpdateStock(index, { quantity: parseInt(e.target.value) || 0 })}
                              placeholder="Quantité"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => handleUpdateStock(index, { price: parseFloat(e.target.value) || 0 })}
                              placeholder="Prix (DA)"
                            />
                          </div>
                        ) : (
                          <div className="flex-1">
                            <h3 className="font-semibold">{item.medication_name}</h3>
                            <div className="text-sm text-gray-600">
                              Quantité: {item.quantity} • Prix: {item.price} DA
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 ml-4">
                          <Switch
                            checked={item.available}
                            onCheckedChange={(checked) => handleUpdateStock(index, { available: checked })}
                          />
                          <Label className="text-sm">Disponible</Label>
                          
                          {editingStockIndex === index ? (
                            <Button
                              size="sm"
                              onClick={() => setEditingStockIndex(-1)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingStockIndex(index)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          
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
                      <p className="text-gray-500">Aucun article en stock</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders" className="space-y-6">
            <h2 className="text-2xl font-bold">Gestion des Commandes</h2>
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardContent className="text-center py-8">
                <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Commandes à venir</h3>
                <p className="text-gray-500">La gestion des commandes sera bientôt disponible</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-6">
            <h2 className="text-2xl font-bold">Paramètres Pharmacie</h2>
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardContent className="text-center py-8">
                <p className="text-gray-600">Paramètres de configuration à venir...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleAddStock}
                disabled={!newStockItem.medication_name.trim() || isLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {isLoading ? 'Ajout...' : 'Ajouter'}
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

export default PharmacyDashboard;