import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Loader, MapPin, Phone, Mail, Lock, User } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Label } from './components/ui/label';
import { Alert, AlertDescription } from './components/ui/alert';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

function LoginPage() {
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });
  const [registerData, setRegisterData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    pharmacy_id: '',
    phone: ''
  });
  const [pharmacies, setPharmacies] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessingGoogleAuth, setIsProcessingGoogleAuth] = useState(false);

  useEffect(() => {
    // Check for session_id in URL fragment (Google OAuth callback)
    const handleGoogleAuth = () => {
      const fragment = window.location.hash.substring(1);
      const params = new URLSearchParams(fragment);
      const sessionId = params.get('session_id');
      
      if (sessionId) {
        processGoogleSession(sessionId);
        // Clean URL fragment
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
      }
      return false;
    };

    // Check existing session first
    const checkExistingSession = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
          withCredentials: true
        });
        
        // User is already authenticated
        if (response.data.role === 'pharmacy') {
          window.location.href = '/pharmacy-dashboard';
        } else if (response.data.role === 'admin') {
          window.location.href = '/admin';
        }
      } catch (error) {
        // Not authenticated, continue with normal flow
      }
    };

    // Process Google auth if session_id exists, otherwise check existing session
    if (!handleGoogleAuth()) {
      checkExistingSession();
    }

    loadPharmacies();
  }, []);

  const processGoogleSession = async (sessionId) => {
    setIsProcessingGoogleAuth(true);
    setError('');

    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/session-data`, {
        headers: {
          'X-Session-ID': sessionId
        },
        withCredentials: true
      });

      // Set session cookie and redirect based on role
      if (response.data.role === 'pharmacy') {
        window.location.href = '/pharmacy-dashboard';
      } else {
        window.location.href = '/admin';
      }
    } catch (error) {
      console.error('Google auth error:', error);
      setError('Erreur lors de l\'authentification Google. Veuillez réessayer.');
    } finally {
      setIsProcessingGoogleAuth(false);
    }
  };

  const loadPharmacies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/pharmacies`);
      setPharmacies(response.data);
    } catch (error) {
      console.error('Error loading pharmacies:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, loginData, {
        withCredentials: true
      });

      // Redirect to pharmacy dashboard
      window.location.href = '/pharmacy-dashboard';
    } catch (error) {
      setError(error.response?.data?.detail || 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (registerData.password !== registerData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!registerData.pharmacy_id) {
      setError('Veuillez sélectionner une pharmacie');
      return;
    }

    setIsLoading(true);

    try {
      await axios.post(`${API_BASE_URL}/api/auth/register`, {
        username: registerData.username,
        password: registerData.password,
        pharmacy_id: registerData.pharmacy_id,
        phone: registerData.phone
      });

      setSuccess('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
      setRegisterData({
        username: '',
        password: '',
        confirmPassword: '',
        pharmacy_id: '',
        phone: ''
      });
    } catch (error) {
      setError(error.response?.data?.detail || 'Erreur lors de la création du compte');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const redirectUrl = encodeURIComponent(`${window.location.origin}/login`);
    window.location.href = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
  };

  if (isProcessingGoogleAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="text-center py-8">
            <Loader className="h-12 w-12 mx-auto text-emerald-600 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Connexion en cours...</h3>
            <p className="text-gray-500">Traitement de votre authentification Google</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">PharmaCarte</h1>
              <p className="text-sm text-gray-600">Connexion Pharmacie</p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="register">Inscription</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="space-y-4">
                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="username">Nom d'utilisateur</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="username"
                        type="text"
                        value={loginData.username}
                        onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                        placeholder="Votre nom d'utilisateur"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                        placeholder="Votre mot de passe"
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      'Se connecter'
                    )}
                  </Button>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500">Ou</span>
                  </div>
                </div>

                <Button
                  onClick={handleGoogleLogin}
                  variant="outline"
                  className="w-full border-gray-300 hover:bg-gray-50"
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Connexion avec Google
                </Button>

                <div className="text-center mt-4">
                  <Button
                    onClick={() => window.location.href = '/'}
                    variant="link"
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    Retour au site
                  </Button>
                </div>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register" className="space-y-4">
                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}
                
                {success && (
                  <Alert className="border-green-200 bg-green-50">
                    <AlertDescription className="text-green-700">{success}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="reg-username">Nom d'utilisateur</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="reg-username"
                        type="text"
                        value={registerData.username}
                        onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                        placeholder="Choisir un nom d'utilisateur"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="reg-pharmacy">Pharmacie</Label>
                    <select
                      id="reg-pharmacy"
                      value={registerData.pharmacy_id}
                      onChange={(e) => setRegisterData({...registerData, pharmacy_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="">Sélectionner votre pharmacie</option>
                      {pharmacies.map(pharmacy => (
                        <option key={pharmacy.id} value={pharmacy.id}>
                          {pharmacy.name} - {pharmacy.location.address}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="reg-phone">Téléphone (optionnel)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="reg-phone"
                        type="tel"
                        value={registerData.phone}
                        onChange={(e) => setRegisterData({...registerData, phone: e.target.value})}
                        placeholder="Numéro de téléphone"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="reg-password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="reg-password"
                        type={showPassword ? "text" : "password"}
                        value={registerData.password}
                        onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                        placeholder="Choisir un mot de passe"
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="reg-confirm-password">Confirmer le mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="reg-confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                        placeholder="Confirmer le mot de passe"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Inscription...
                      </>
                    ) : (
                      'Créer le compte'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Comptes de test :</p>
          <div className="mt-2 space-y-1">
            <Badge variant="secondary">pharmacie1 / password123</Badge>
            <Badge variant="secondary">pharmacie2 / password123</Badge>
            <Badge variant="secondary">pharmacie3 / password123</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;